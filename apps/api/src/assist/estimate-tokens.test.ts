import { describe, expect, it } from "vite-plus/test";
import { estimateTokens } from "./estimate-tokens";

describe("estimateTokens", () => {
  it("counts about four characters a token, rounded up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
