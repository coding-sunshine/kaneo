import { describe, expect, it } from "vite-plus/test";
import { readBullets } from "./read-bullets";

describe("readBullets", () => {
  const given = new Set(["t1", "m1"]);

  it("keeps given ids and drops bullets left without a source", () => {
    expect(
      readBullets(
        JSON.stringify({
          bullets: [
            {
              text: "Payments wait on the vendor",
              sources: ["t1", "x9", "t1"],
            },
            { text: "Made up", sources: ["x9"] },
            { text: "No source" },
          ],
        }),
        given,
      ),
    ).toEqual([{ text: "Payments wait on the vendor", sources: ["t1"] }]);
  });

  it("reads JSON in a code fence, and is null for prose", () => {
    expect(
      readBullets(
        '```json\n{"bullets":[{"text":"A","sources":["m1"]}]}\n```',
        given,
      ),
    ).toEqual([{ text: "A", sources: ["m1"] }]);
    expect(readBullets("Here you go", given)).toBeNull();
  });
});
