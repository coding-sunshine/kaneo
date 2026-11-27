// Local completions only: other people's changes arrive through the cache and
// never call this, so their work does not animate on your screen.
const listeners = new Set<() => void>();

export function celebrateCompletion() {
  for (const listener of listeners) listener();
}

export function onCompletionCelebration(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
