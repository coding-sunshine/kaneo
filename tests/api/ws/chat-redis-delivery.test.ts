import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  on: vi.fn(),
  publish: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));
vi.mock("../../../apps/api/src/ws/chat-channel-readers", () => ({
  findChannelReaders: m.lookup,
}));
vi.mock("../../../apps/api/src/redis", () => ({
  isRedisConfigured: () => true,
  getRedisPub: () => ({ publish: m.publish }),
  getRedisSub: () => ({
    on: m.on,
    off: vi.fn(),
    psubscribe: vi.fn(async () => {}),
    punsubscribe: vi.fn(),
  }),
  closeRedis: vi.fn(),
}));

import {
  broadcastChatTyping,
  broadcastToChatChannel,
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws/index";
import {
  addChatConnection,
  removeChatConnection,
} from "../../../apps/api/src/ws/chat-connections";

const CHAT_PATTERN = "kaneo:ws-chat:*:broadcast";
const chatChannel = (id: string) => `kaneo:ws-chat:${id}:broadcast`;

function chatHandler() {
  return (
    m.on.mock.calls as Array<
      [string, (pattern: string, channel: string, data: string) => void]
    >
  )
    .filter(([event]) => event === "pmessage")
    .map(([, handler]) => handler);
}

function receive(channel: string, data: unknown) {
  for (const handler of chatHandler())
    handler(CHAT_PATTERN, channel, JSON.stringify(data));
}

let conn: ReturnType<typeof addChatConnection>;
let ws: { send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

beforeEach(async () => {
  m.on.mockReset();
  m.publish.mockReset().mockResolvedValue(1);
  m.lookup
    .mockReset()
    .mockResolvedValue({ workspaceId: "workspace", readers: new Set(["b"]) });
  ws = { send: vi.fn(), close: vi.fn() };
  conn = addChatConnection("channel-1", ws as never, "b", "workspace");
  await initializeWebSocketAdapter();
});

afterEach(async () => {
  removeChatConnection("channel-1", conn);
  await shutdownWebSocketAdapter();
});

it("publishes only the channel id to other instances and ignores its own echo", async () => {
  await broadcastToChatChannel("channel-1");

  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(m.publish).toHaveBeenCalledTimes(1);
  const [channel, data] = m.publish.mock.calls[0];
  expect(channel).toBe(chatChannel("channel-1"));
  const published = JSON.parse(data);
  expect(published.message).toEqual({
    type: "CHAT_MESSAGE_CREATED",
    channelId: "channel-1",
  });

  receive(channel, published);
  await vi.waitFor(() => expect(m.lookup).toHaveBeenCalledTimes(1));
  expect(ws.send).toHaveBeenCalledTimes(1);
});

it("delivers a message posted on another instance to local readers", async () => {
  receive(chatChannel("channel-1"), {
    channelId: "channel-1",
    message: { type: "CHAT_MESSAGE_CREATED", channelId: "channel-1" },
    origin: "other-instance",
  });

  await vi.waitFor(() =>
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "CHAT_MESSAGE_CREATED", channelId: "channel-1" }),
    ),
  );
});

it("ignores a broadcast whose Redis channel and payload disagree", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  receive(chatChannel("channel-2"), {
    channelId: "channel-1",
    message: { type: "CHAT_MESSAGE_CREATED", channelId: "channel-1" },
    origin: "other-instance",
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(ws.send).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(
    "Chat broadcast channel and payload disagree",
  );
  error.mockRestore();
});

it("carries typing from another instance to local readers, and only to them", async () => {
  const typing = {
    type: "CHAT_TYPING",
    channelId: "channel-1",
    userId: "a",
    typing: true,
  };
  receive(chatChannel("channel-1"), {
    channelId: "channel-1",
    message: typing,
    origin: "other-instance",
  });

  await vi.waitFor(() =>
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(typing)),
  );
  expect(m.lookup).toHaveBeenCalledWith("channel-1", ["b"]);
});

it("publishes typing to other instances with who is typing", async () => {
  await broadcastChatTyping("channel-1", "a", false);

  const published = JSON.parse(m.publish.mock.calls[0][1]);
  expect(published.message).toEqual({
    type: "CHAT_TYPING",
    channelId: "channel-1",
    userId: "a",
    typing: false,
  });
});
