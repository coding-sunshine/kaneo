export type RateLimitRule = { window: number; max: number };

type Entry = { count: number; expiresAt: number };

/**
 * Fixed-window counters in memory, like Better Auth's default storage.
 * Keys carry caller-chosen account values, so the map is capped. A live
 * counter is never dropped to make room: that would hand a guesser a fresh
 * limit by flooding new keys. Once the cap holds only live counters, new
 * keys share the caller's overflow key instead, which may go past the cap.
 */
export function createRateLimitStore(maxEntries = 10_000) {
  const entries = new Map<string, Entry>();

  const live = (key: string, now: number) => {
    const entry = entries.get(key);
    if (entry && entry.expiresAt > now) return entry;
    entries.delete(key);
    return undefined;
  };

  const purgeExpired = (now: number) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  };

  return {
    /** Charges `key`, or `overflowKey` when the store is full; returns which. */
    consume(
      key: string,
      rule: RateLimitRule,
      overflowKey: string,
      now = Date.now(),
    ) {
      let charged = key;
      let entry = live(key, now);
      if (!entry && entries.size >= maxEntries) {
        purgeExpired(now);
        if (entries.size >= maxEntries) {
          charged = overflowKey;
          entry = live(overflowKey, now);
        }
      }
      if (!entry) {
        entries.set(charged, { count: 1, expiresAt: now + rule.window * 1000 });
        return { allowed: true as const, key: charged };
      }
      if (entry.count >= rule.max) {
        return {
          allowed: false as const,
          key: charged,
          retryAfter: Math.ceil((entry.expiresAt - now) / 1000),
        };
      }
      entry.count++;
      return { allowed: true as const, key: charged };
    },
    /** Gives back one charge, for an attempt that turned out not to count. */
    refund(key: string, now = Date.now()) {
      const entry = live(key, now);
      if (entry && entry.count > 0) entry.count--;
    },
    get size() {
      return entries.size;
    },
  };
}
