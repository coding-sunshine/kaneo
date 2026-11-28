import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useTypingSignal } from "./use-typing-signal";

const { sendTyping } = vi.hoisted(() => ({
  sendTyping: vi.fn(
    async (_workspaceId: string, _channelId: string, _typing: boolean) => ({}),
  ),
}));
vi.mock("@/fetchers/chat/typing", () => ({ sendTyping }));

const sent = () => sendTyping.mock.calls.map((call) => call[2]);
const render = () => renderHook(() => useTypingSignal("ws-1", "channel-1"));

describe("useTypingSignal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendTyping.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("says typing on the first key, then at most every 3 seconds", () => {
    const { result } = render();
    act(() => result.current.typed("h"));
    expect(sendTyping).toHaveBeenCalledWith("ws-1", "channel-1", true);
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.typed("he"));
    expect(sent()).toEqual([true]);
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.typed("hel"));
    expect(sent()).toEqual([true, true]);
  });

  it("says stopped 5 seconds after the last key", () => {
    const { result } = render();
    act(() => result.current.typed("h"));
    act(() => vi.advanceTimersByTime(4999));
    expect(sent()).toEqual([true]);
    act(() => vi.advanceTimersByTime(1));
    expect(sent()).toEqual([true, false]);
    act(() => vi.advanceTimersByTime(10_000));
    expect(sent()).toEqual([true, false]);
  });

  it("says stopped at once on send or when the text is cleared", () => {
    const { result } = render();
    act(() => result.current.typed("h"));
    act(() => result.current.stop());
    expect(sent()).toEqual([true, false]);
    act(() => result.current.typed("x"));
    act(() => result.current.typed(""));
    expect(sent()).toEqual([true, false, true, false]);
    act(() => vi.advanceTimersByTime(10_000));
    expect(sent()).toHaveLength(4);
  });

  it("sends nothing when stopping without typing, and stops on leaving", () => {
    const { result, unmount } = render();
    act(() => result.current.stop());
    expect(sendTyping).not.toHaveBeenCalled();
    act(() => result.current.typed("h"));
    unmount();
    expect(sent()).toEqual([true, false]);
  });
});
