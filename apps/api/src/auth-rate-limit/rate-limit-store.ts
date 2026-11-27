export type RateLimitRule = { window: number; max: number };

type Entry = { count: number; expiresAt: number };

/**
 * Fixed-window counters in memory, like Better Auth's default storage.
 * Keys carry caller-chosen account values, so the map is capped: expired
 * entries go first, then the oldest.
 */
export function createRateLimitStore(maxEntries = 10_000) {
  const entries = new Map<string, Entry>();

  const makeRoom = (now: number) => {
    if (entries.size < maxEntries) return;
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
    for (const key of entries.keys()) {
      if (entries.size < maxEntries) break;
      entries.delete(key);
    }
  };

  return {
    consume(key: string, rule: RateLimitRule, now = Date.now()) {
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= now) {
        entries.delete(key);
        makeRoom(now);
        entries.set(key, { count: 1, expiresAt: now + rule.window * 1000 });
        return { allowed: true as const };
      }
      if (entry.count >= rule.max) {
        return {
          allowed: false as const,
          retryAfter: Math.ceil((entry.expiresAt - now) / 1000),
        };
      }
      entry.count++;
      return { allowed: true as const };
    },
    get size() {
      return entries.size;
    },
  };
}
