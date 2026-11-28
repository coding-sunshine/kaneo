import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useTypingUsers } from "./use-typing-users";

describe("useTypingUsers", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lists who is typing until they stop", () => {
    const { result } = renderHook(() => useTypingUsers("channel-1", "me"));
    act(() => result.current.onTyping("a", true));
    act(() => result.current.onTyping("b", true));
    expect(result.current.typing).toEqual(["a", "b"]);
    act(() => result.current.onTyping("a", false));
    expect(result.current.typing).toEqual(["b"]);
  });

  it("never lists the viewer", () => {
    const { result } = renderHook(() => useTypingUsers("channel-1", "me"));
    act(() => result.current.onTyping("me", true));
    expect(result.current.typing).toEqual([]);
  });

  it("forgets someone whose stop never arrived", () => {
    const { result } = renderHook(() => useTypingUsers("channel-1", "me"));
    act(() => result.current.onTyping("a", true));
    act(() => vi.advanceTimersByTime(4000));
    act(() => result.current.onTyping("a", true));
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.typing).toEqual(["a"]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.typing).toEqual([]);
  });

  it("starts empty in another channel", () => {
    const { result, rerender } = renderHook(
      ({ channelId }) => useTypingUsers(channelId, "me"),
      { initialProps: { channelId: "channel-1" } },
    );
    act(() => result.current.onTyping("a", true));
    rerender({ channelId: "channel-2" });
    expect(result.current.typing).toEqual([]);
  });
});
