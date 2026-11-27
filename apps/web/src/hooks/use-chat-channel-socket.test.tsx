import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useChatChannelSocket } from "./use-chat-channel-socket";

const { client } = vi.hoisted(() => ({
  client: { invalidateQueries: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event?: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });
  constructor(public url: string) {
    TestSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

const messages = { queryKey: ["chat-messages", "ws-1", "channel-1"] };
const latest = () => TestSocket.instances[TestSocket.instances.length - 1];
const render = (enabled = true) =>
  renderHook(() => useChatChannelSocket("ws-1", "channel-1", enabled));

describe("useChatChannelSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", TestSocket);
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
    TestSocket.instances = [];
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("waits for the channel before subscribing", () => {
    render(false);
    expect(TestSocket.instances).toHaveLength(0);
  });

  it("subscribes to the channel and refetches messages when one is posted", () => {
    const { result } = render();
    expect(latest().url).toBe("ws://localhost:1337/api/ws/chat/channel-1");
    expect(result.current).toBe(false);

    act(() => latest().open());
    expect(result.current).toBe(true);
    client.invalidateQueries.mockClear();

    act(() =>
      latest().onmessage?.({
        data: JSON.stringify({
          type: "CHAT_MESSAGE_CREATED",
          channelId: "channel-2",
        }),
      }),
    );
    expect(client.invalidateQueries).not.toHaveBeenCalled();

    act(() =>
      latest().onmessage?.({
        data: JSON.stringify({
          type: "CHAT_MESSAGE_CREATED",
          channelId: "channel-1",
        }),
      }),
    );
    expect(client.invalidateQueries).toHaveBeenCalledWith(messages);
  });

  it("refetches messages when one changes, such as a new link preview", () => {
    render();
    act(() => latest().open());
    client.invalidateQueries.mockClear();

    act(() =>
      latest().onmessage?.({
        data: JSON.stringify({
          type: "CHAT_MESSAGE_UPDATED",
          channelId: "channel-1",
        }),
      }),
    );
    expect(client.invalidateQueries).toHaveBeenCalledWith(messages);
  });

  it("catches up on messages it missed after reconnecting", () => {
    const { result } = render();
    act(() => latest().open());
    act(() => latest().onclose?.({ code: 1006 }));
    expect(result.current).toBe(false);
    client.invalidateQueries.mockClear();

    act(() => vi.advanceTimersByTime(1000));
    expect(TestSocket.instances).toHaveLength(2);
    act(() => latest().open());

    expect(client.invalidateQueries).toHaveBeenCalledWith(messages);
    expect(result.current).toBe(true);
  });

  it("reconnects at once when the browser comes back online", () => {
    render();
    act(() => latest().open());
    const stale = latest();
    client.invalidateQueries.mockClear();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(stale.close).toHaveBeenCalled();
    expect(TestSocket.instances).toHaveLength(2);
    act(() => stale.onclose?.({ code: 1006 }));
    act(() => latest().open());

    expect(client.invalidateQueries).toHaveBeenCalledWith(messages);
    act(() => vi.advanceTimersByTime(60_000));
    expect(TestSocket.instances).toHaveLength(2);
  });

  it("stops and rechecks the channel when access is revoked", () => {
    const { result } = render();
    act(() => latest().open());
    client.invalidateQueries.mockClear();

    act(() => latest().onclose?.({ code: 1008 }));

    expect(result.current).toBe(false);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["chat-channel", "ws-1", "channel-1"],
    });
    act(() => vi.advanceTimersByTime(60_000));
    expect(TestSocket.instances).toHaveLength(1);
  });

  it("closes the socket when the channel view unmounts", () => {
    const { unmount } = render();
    act(() => latest().open());
    unmount();
    expect(latest().close).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(TestSocket.instances).toHaveLength(1);
  });
});
