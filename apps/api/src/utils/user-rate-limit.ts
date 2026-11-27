type Window = { count: number; resetAt: number };

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * A fixed-window limit per user, kept in this process. With several API
 * instances each one counts on its own, which is enough to stop one user from
 * flooding a feature without needing Redis.
 */
export function createUserRateLimit(
  { limit, windowMs }: { limit: number; windowMs: number },
  now: () => number = Date.now,
) {
  const windows = new Map<string, Window>();
  let nextSweep = 0;

  function sweep(at: number) {
    if (at < nextSweep) return;
    nextSweep = at + windowMs;
    for (const [userId, window] of windows)
      if (window.resetAt <= at) windows.delete(userId);
  }

  return {
    take(userId: string): RateLimitResult {
      const at = now();
      sweep(at);
      const current = windows.get(userId);
      if (!current || current.resetAt <= at) {
        windows.set(userId, { count: 1, resetAt: at + windowMs });
        return { ok: true };
      }
      if (current.count >= limit)
        return {
          ok: false,
          retryAfterSeconds: Math.ceil((current.resetAt - at) / 1000),
        };
      current.count += 1;
      return { ok: true };
    },
    size: () => windows.size,
  };
}
