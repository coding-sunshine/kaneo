import { describe, expect, it } from "vite-plus/test";
import { parseRiskLevel } from "./risk-score";

const sha = "a".repeat(40);
const block = (...plugins: object[]) =>
  `<!-- linear:extension ${JSON.stringify({ version: 1, plugins })} -->`;
const risk = (extra: object) => ({ plugin: "riskScore", level: 2, ...extra });

describe("parseRiskLevel", () => {
  it("reads the level from any text", () => {
    expect(parseRiskLevel(["hi", block(risk({ level: 3 }))], sha)).toBe(3);
  });

  it("raises to the highest area unless overridden", () => {
    const areas = [{ name: "auth", level: 4 }];
    expect(parseRiskLevel([block(risk({ areas }))], sha)).toBe(4);
    expect(parseRiskLevel([block(risk({ areas, override: true }))], sha)).toBe(
      2,
    );
  });

  it("skips a stale head and keeps the newest entry that remains", () => {
    const texts = [
      block(risk({ level: 4, sha: "b".repeat(40) })),
      block(risk({ level: 1 })),
      block(risk({ level: 3 })),
      block(risk({ level: 2 })),
    ];
    expect(parseRiskLevel(texts, sha)).toBe(2);
  });

  it("lets the newest valid entry win, including over an older higher one", () => {
    expect(
      parseRiskLevel(
        [block(risk({ level: 4 })), block(risk({ level: 1 }))],
        sha,
      ),
    ).toBe(1);
    expect(
      parseRiskLevel(
        [
          block(risk({ level: 4, sha: "b".repeat(40) })),
          block(risk({ level: 3 })),
          block(risk({ level: 2 })),
        ],
        sha,
      ),
    ).toBe(2);
  });

  it("keeps the level when an explanation or area name is not used", () => {
    expect(
      parseRiskLevel(
        [
          block(
            risk({
              level: 2,
              explanations: ["x".repeat(500)],
              areas: [
                {
                  name: "line\nbreak",
                  level: 4,
                  explanation: "y".repeat(500),
                },
              ],
            }),
          ),
        ],
        sha,
      ),
    ).toBe(4);
  });

  it("still finds the valid block in a large text of unclosed openers", () => {
    const noise = "<!-- linear:extension {".repeat(3000);
    const gap = "x".repeat(9000);
    expect(noise.length).toBeGreaterThan(64_000);
    expect(
      parseRiskLevel([`${noise}${gap}${block(risk({ level: 3 }))}`], sha),
    ).toBe(3);
  });

  it("ignores invalid entries and other plugins", () => {
    expect(parseRiskLevel([block(risk({ level: 9 }))], sha)).toBeNull();
    expect(parseRiskLevel([block(risk({ extra: 1 }))], sha)).toBeNull();
    expect(
      parseRiskLevel([block({ plugin: "other", level: 4 })], sha),
    ).toBeNull();
    expect(
      parseRiskLevel(["<!-- linear:extension {nope} -->"], sha),
    ).toBeNull();
  });
});
