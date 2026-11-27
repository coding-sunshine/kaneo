import { cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { usePresenceHeartbeat } from "./use-presence-heartbeat";

const { beat } = vi.hoisted(() => ({ beat: vi.fn() }));
vi.mock("@/fetchers/chat/presence", () => ({ sendPresenceHeartbeat: beat }));

describe("usePresenceHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    beat.mockResolvedValue({ enabled: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("sends nothing while presence is off", () => {
    renderHook(() => usePresenceHeartbeat(false));
    vi.advanceTimersByTime(120_000);
    expect(beat).not.toHaveBeenCalled();
  });

  it("beats at once and every 30 seconds while on, and stops when turned off", () => {
    const { rerender } = renderHook(
      ({ on }: { on: boolean }) => usePresenceHeartbeat(on),
      { initialProps: { on: true } },
    );
    expect(beat).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(beat).toHaveBeenCalledTimes(3);
    rerender({ on: false });
    vi.advanceTimersByTime(60_000);
    expect(beat).toHaveBeenCalledTimes(3);
  });
});
