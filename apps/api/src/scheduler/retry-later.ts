/** Remembers, in this process, which calls failed and when to try them again. */
// ponytail: the memory is lost on restart and is per process; a failing call
// is tried once more after a restart. Keep it in the database when that costs.
export function retryLater(waitMs: number) {
  const until = new Map<string, number>();
  return {
    failed(key: string, now = Date.now()) {
      until.set(key, now + waitMs);
    },
    waiting(key: string, now = Date.now()) {
      return (until.get(key) ?? 0) > now;
    },
    reset() {
      until.clear();
    },
  };
}
