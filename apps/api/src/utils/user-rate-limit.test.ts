import { describe, expect, it } from "vite-plus/test";
import { createUserRateLimit } from "./user-rate-limit";

describe("createUserRateLimit", () => {
  it("allows the limit per user in each window, then refuses until it resets", () => {
    let now = 1_000;
    const limit = createUserRateLimit(
      { limit: 2, windowMs: 60_000 },
      () => now,
    );

    expect(limit.take("user-1")).toEqual({ ok: true });
    expect(limit.take("user-1")).toEqual({ ok: true });
    expect(limit.take("user-1")).toEqual({ ok: false, retryAfterSeconds: 60 });
    // Another user has their own budget.
    expect(limit.take("user-2")).toEqual({ ok: true });

    now += 30_000;
    expect(limit.take("user-1")).toEqual({ ok: false, retryAfterSeconds: 30 });
    now += 30_000;
    expect(limit.take("user-1")).toEqual({ ok: true });
  });

  it("forgets users whose window has passed", () => {
    let now = 0;
    const limit = createUserRateLimit({ limit: 1, windowMs: 1_000 }, () => now);
    for (let i = 0; i < 100; i++) limit.take(`user-${i}`);
    now = 5_000;
    limit.take("user-new");
    expect(limit.size()).toBe(1);
  });
});
