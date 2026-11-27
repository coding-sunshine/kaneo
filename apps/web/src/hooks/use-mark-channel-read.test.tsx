import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useMarkChannelRead } from "./use-mark-channel-read";

const { markRead } = vi.hoisted(() => ({ markRead: vi.fn() }));
vi.mock("@/hooks/mutations/chat/use-channel-mutations", () => ({
  useMarkChannelRead: () => ({ mutate: markRead }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useMarkChannelRead", () => {
  it("marks the channel read when opened and when a new message shows", () => {
    const { rerender } = renderHook(
      ({ last }: { last?: string }) =>
        useMarkChannelRead("ws", "channel-1", true, last),
      { initialProps: { last: "m1" } },
    );
    expect(markRead).toHaveBeenCalledTimes(1);
    rerender({ last: "m1" });
    expect(markRead).toHaveBeenCalledTimes(1);
    rerender({ last: "m2" });
    expect(markRead).toHaveBeenCalledTimes(2);
  });

  it("marks nothing in a channel you have not joined", () => {
    renderHook(() => useMarkChannelRead("ws", "channel-1", false, "m1"));
    expect(markRead).not.toHaveBeenCalled();
  });
});
