import { expect, it } from "vite-plus/test";
import { textParts } from "./text-parts";

it("reads a long document in parts", () => {
  expect(textParts("short", 100, 20)).toEqual(["short"]);

  const text = Array.from(
    { length: 1000 },
    (_, i) => String.fromCharCode(97 + (i % 26)) + (i % 10),
  ).join("");
  const parts = textParts(text, 300, 200);
  expect(parts.length).toBeGreaterThan(1);
  for (const part of parts) expect(part.length).toBeLessThanOrEqual(300);
  expect(text.endsWith(parts.at(-1) ?? "")).toBe(true);
  for (let at = 0; at + 200 <= text.length; at++) {
    const passage = text.slice(at, at + 200);
    expect(parts.some((part) => part.includes(passage))).toBe(true);
  }
});
