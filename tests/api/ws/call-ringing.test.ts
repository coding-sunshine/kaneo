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

import { subscribeToEvent } from "../../../apps/api/src/events";
import {
  addUserConnection,
  initializeWebSocketAdapter,
  removeUserConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws/index";

const callStarted = vi
  .mocked(subscribeToEvent)
  .mock.calls.find(([name]) => name === "chat.call_started")?.[1];

const fakeWs = () =>
  ({ send: vi.fn(), close: vi.fn(), readyState: 1 }) as unknown as Parameters<
    typeof addUserConnection
  >[1];
const sent = (ws: unknown) =>
  (ws as { send: ReturnType<typeof vi.fn> }).send.mock.calls.map(([raw]) =>
    JSON.parse(raw),
  );

describe("call ringing", () => {
  beforeEach(async () => {
    delete process.env.REDIS_URL;
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });

  it("rings every recipient and nobody else", async () => {
    const callee = fakeWs();
    const other = fakeWs();
    const calleeConn = addUserConnection("user-b", callee);
    const otherConn = addUserConnection("user-c", other);

    expect(callStarted).toBeDefined();
    await callStarted?.({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      channelName: "pair",
      callerId: "user-a",
      callerName: "Test caller",
      recipientIds: ["user-b"],
    });

    expect(sent(callee)).toEqual([
      {
        type: "CALL_RINGING",
        workspaceId: "workspace-1",
        channelId: "channel-1",
        channelName: "pair",
        callerName: "Test caller",
      },
    ]);
    expect(sent(other)).toEqual([]);
    removeUserConnection("user-b", calleeConn);
    removeUserConnection("user-c", otherConn);
  });
});
