import { vi } from "vite-plus/test";

// withEchoConfirmation gives up on a pending provider echo after 5s of wall
// clock. Moving only `Date` forward reaches that deadline in a few retries.
export async function skipEchoDeadline<T>(run: () => Promise<T>) {
  vi.useFakeTimers({ toFake: ["Date"] });
  const ticker = setInterval(() => vi.advanceTimersByTime(500), 20);
  try {
    return await run();
  } finally {
    clearInterval(ticker);
    vi.useRealTimers();
  }
}
