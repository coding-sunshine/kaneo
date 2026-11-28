import { describe, expect, it } from "vite-plus/test";

import { notificationRoute } from "./notification-route";

describe("notificationRoute", () => {
  it("opens the channel of a chat push", () => {
    expect(
      notificationRoute({
        kind: "chat",
        workspaceId: "ws-1",
        chatChannelId: "ch-1",
      }),
    ).toEqual({
      pathname: "/chat/[channelId]",
      params: { channelId: "ch-1", workspaceId: "ws-1" },
    });
  });

  it("opens the task of a background notification", () => {
    expect(notificationRoute({ taskId: "t-1" })).toEqual({
      pathname: "/task/[taskId]",
      params: { taskId: "t-1" },
    });
  });

  it("opens nothing for anything else", () => {
    expect(notificationRoute({})).toBeNull();
    expect(notificationRoute(undefined)).toBeNull();
    expect(notificationRoute({ kind: "chat", chatChannelId: 3 })).toBeNull();
  });
});
