import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

const readers = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("../../../apps/api/src/ws/chat-channel-readers", () => ({
  findChannelReaders: readers.lookup,
}));

import { subscribeToEvent } from "../../../apps/api/src/events";
import {
  broadcastToChatChannel,
  getLocalRealtimeStats,
  initializeWebSocketAdapter,
  revokeApiKeyConnections,
  revokeSessionConnections,
  revokeUserConnections,
  revokeWorkspaceConnections,
  SESSION_ENDED_CLOSE_CODE,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws/index";
import {
  addChatConnection,
  removeChatConnection,
} from "../../../apps/api/src/ws/chat-connections";
import { InMemoryBroadcastAdapter } from "../../../apps/api/src/ws/in-memory-broadcast-adapter";

const messageCreatedHandler = vi
  .mocked(subscribeToEvent)
  .mock.calls.find(([name]) => name === "chat.message_created")?.[1];

function makeFakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    raw: undefined,
    url: null,
    protocol: null,
  } as never;
}

function mocksOf(ws: unknown) {
  return ws as {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

const sentTo = (ws: unknown) =>
  mocksOf(ws).send.mock.calls.map(([payload]) => JSON.parse(payload));

function allow(workspaceId: string, ...userIds: string[]) {
  readers.lookup.mockImplementation(async () => ({
    workspaceId,
    readers: new Set(userIds),
  }));
}

const opened: Array<[string, ReturnType<typeof addChatConnection>]> = [];
function connect(
  channelId: string,
  userId: string,
  workspaceId = "workspace-1",
  sessionId: string | null = `session-${userId}`,
  apiKeyId?: string,
) {
  const ws = makeFakeWs();
  const conn = addChatConnection(
    channelId,
    ws,
    userId,
    workspaceId,
    sessionId,
    apiKeyId,
  );
  opened.push([channelId, conn]);
  return ws;
}

describe("chat channel realtime delivery", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    readers.lookup.mockReset();
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    for (const [channelId, conn] of opened.splice(0))
      removeChatConnection(channelId, conn);
    vi.restoreAllMocks();
    await shutdownWebSocketAdapter();
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
  });

  it("delivers a posted message to every reader of that channel only, once, without its body", async () => {
    allow("workspace-1", "user-a", "user-b");
    const a = connect("channel-1", "user-a");
    const b = connect("channel-1", "user-b");
    const other = connect("channel-2", "user-b");

    await broadcastToChatChannel("channel-1");

    const expected = { type: "CHAT_MESSAGE_CREATED", channelId: "channel-1" };
    expect(sentTo(a)).toEqual([expected]);
    expect(sentTo(b)).toEqual([expected]);
    expect(mocksOf(other).send).not.toHaveBeenCalled();
  });

  it("delivers through the chat.message_created event", async () => {
    allow("workspace-1", "user-b");
    const b = connect("channel-1", "user-b");

    expect(messageCreatedHandler).toBeDefined();
    await messageCreatedHandler?.({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      messageId: "message-1",
    });

    expect(sentTo(b)).toEqual([
      { type: "CHAT_MESSAGE_CREATED", channelId: "channel-1" },
    ]);
  });

  it("closes the socket of a user who can no longer read the channel and sends it nothing", async () => {
    allow("workspace-1", "user-a");
    const a = connect("channel-1", "user-a");
    const left = connect("channel-1", "user-c");

    await broadcastToChatChannel("channel-1");

    expect(mocksOf(left).send).not.toHaveBeenCalled();
    expect(mocksOf(left).close).toHaveBeenCalledWith(
      1008,
      "Channel access revoked",
    );
    expect(sentTo(a)).toHaveLength(1);

    await broadcastToChatChannel("channel-1");
    expect(mocksOf(left).send).not.toHaveBeenCalled();
    expect(sentTo(a)).toHaveLength(2);
  });

  it("closes a socket opened in another workspace than the channel's", async () => {
    allow("workspace-2", "user-a");
    const a = connect("channel-1", "user-a", "workspace-1");

    await broadcastToChatChannel("channel-1");

    expect(mocksOf(a).send).not.toHaveBeenCalled();
    expect(mocksOf(a).close).toHaveBeenCalledWith(
      1008,
      "Channel access revoked",
    );
  });

  it("sends nothing when the access lookup fails", async () => {
    readers.lookup.mockResolvedValue(null);
    const a = connect("channel-1", "user-a");

    await broadcastToChatChannel("channel-1");

    expect(mocksOf(a).send).not.toHaveBeenCalled();
    expect(mocksOf(a).close).not.toHaveBeenCalled();
  });

  it("still delivers locally when cross-instance publishing fails", async () => {
    allow("workspace-1", "user-a");
    vi.spyOn(
      InMemoryBroadcastAdapter.prototype,
      "publishToChat",
    ).mockRejectedValue(new Error("fan-out down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const a = connect("channel-1", "user-a");

    await expect(broadcastToChatChannel("channel-1")).resolves.toBeUndefined();

    expect(sentTo(a)).toHaveLength(1);
  });

  it("still delivers locally before the broadcast adapter starts", async () => {
    await shutdownWebSocketAdapter();
    allow("workspace-1", "user-a");
    const a = connect("channel-1", "user-a");

    await broadcastToChatChannel("channel-1");

    expect(sentTo(a)).toHaveLength(1);
  });

  it("closes chat sockets of an ended session", async () => {
    const ended = connect("channel-1", "user-a", "workspace-1", "session-old");
    const kept = connect("channel-1", "user-a", "workspace-1", "session-new");

    await revokeSessionConnections("user-a", ["session-old"]);

    expect(mocksOf(ended).close).toHaveBeenCalledWith(
      SESSION_ENDED_CLOSE_CODE,
      "Session ended",
    );
    expect(mocksOf(kept).close).not.toHaveBeenCalled();
  });

  it("closes chat sockets opened with a revoked API key", async () => {
    const keyed = connect("channel-1", "user-a", "workspace-1", null, "key-1");

    await revokeApiKeyConnections("user-a", ["key-1"]);

    expect(mocksOf(keyed).close).toHaveBeenCalledWith(1008, "API key revoked");
  });

  it("closes chat sockets in a workspace the user lost", async () => {
    const lost = connect("channel-1", "user-a", "workspace-1");
    const kept = connect("channel-9", "user-a", "workspace-2");

    await revokeWorkspaceConnections("user-a", "workspace-1", {
      force: true,
    });

    expect(mocksOf(lost).close).toHaveBeenCalledWith(
      1008,
      "Workspace access revoked",
    );
    expect(mocksOf(kept).close).not.toHaveBeenCalled();
  });

  it("closes every chat socket of a revoked user", async () => {
    const a = connect("channel-1", "user-a");

    await revokeUserConnections("user-a");

    expect(mocksOf(a).close).toHaveBeenCalledWith(1008, "User access revoked");
  });

  it("counts chat sockets in the realtime stats", () => {
    const before = getLocalRealtimeStats();
    connect("channel-1", "user-stats");

    const after = getLocalRealtimeStats();
    expect(after.connections).toBe(before.connections + 1);
    expect(after.connectedUsers).toBe(before.connectedUsers + 1);
  });
});
