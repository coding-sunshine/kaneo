import { describe, expect, it } from "vite-plus/test";
import { createRateLimitStore } from "./rate-limit-store";

const rule = { window: 10, max: 2 };

describe("createRateLimitStore", () => {
  it("refuses past max and allows again after the window", () => {
    const store = createRateLimitStore();
    expect(store.consume("a", rule, 0).allowed).toBe(true);
    expect(store.consume("a", rule, 1).allowed).toBe(true);
    expect(store.consume("a", rule, 2)).toEqual({
      allowed: false,
      retryAfter: 10,
    });
    expect(store.consume("b", rule, 2).allowed).toBe(true);
    expect(store.consume("a", rule, 10_000).allowed).toBe(true);
  });

  it("never holds more than its cap", () => {
    const store = createRateLimitStore(3);
    for (let i = 0; i < 10; i++) store.consume(`key-${i}`, rule, i);
    expect(store.size).toBe(3);
  });
});
