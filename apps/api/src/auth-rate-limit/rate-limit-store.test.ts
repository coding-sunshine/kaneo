import { describe, expect, it } from "vite-plus/test";
import { createRateLimitStore } from "./rate-limit-store";

const rule = { window: 10, max: 2 };

describe("createRateLimitStore", () => {
  it("refuses past max and allows again after the window", () => {
    const store = createRateLimitStore();
    expect(store.consume("a", rule, "x", 0).allowed).toBe(true);
    expect(store.consume("a", rule, "x", 1).allowed).toBe(true);
    expect(store.consume("a", rule, "x", 2)).toEqual({
      allowed: false,
      key: "a",
      retryAfter: 10,
    });
    expect(store.consume("b", rule, "x", 2).allowed).toBe(true);
    expect(store.consume("a", rule, "x", 10_000).allowed).toBe(true);
  });

  it("keeps a live counter through a flood of new keys", () => {
    const store = createRateLimitStore(3);
    store.consume("guessed", rule, "overflow", 0);
    store.consume("guessed", rule, "overflow", 0);
    for (let i = 0; i < 100; i++) {
      store.consume(`flood-${i}`, rule, "overflow", 1);
    }
    expect(store.consume("guessed", rule, "overflow", 2).allowed).toBe(false);
    // The flood itself ends up sharing the overflow counter.
    expect(store.consume("flood-new", rule, "overflow", 2)).toMatchObject({
      allowed: false,
      key: "overflow",
    });
    expect(store.size).toBe(4);
  });

  it("reuses room once counters expire", () => {
    const store = createRateLimitStore(3);
    for (let i = 0; i < 3; i++) store.consume(`key-${i}`, rule, "overflow", 0);
    expect(store.consume("later", rule, "overflow", 10_000).key).toBe("later");
    expect(store.size).toBe(1);
  });

  it("gives a charge back on refund", () => {
    const store = createRateLimitStore();
    store.consume("a", rule, "x", 0);
    store.consume("a", rule, "x", 0);
    store.refund("a", 1);
    expect(store.consume("a", rule, "x", 2).allowed).toBe(true);
    expect(store.consume("a", rule, "x", 3).allowed).toBe(false);
  });
});
