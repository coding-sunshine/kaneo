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

  it("skips entries for another head and takes the highest of the rest", () => {
    const texts = [
      block(risk({ level: 4, sha: "b".repeat(40) })),
      block(risk({ level: 1 })),
      block(risk({ level: 3 })),
      block(risk({ level: 2 })),
    ];
    expect(parseRiskLevel(texts, sha)).toBe(3);
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
