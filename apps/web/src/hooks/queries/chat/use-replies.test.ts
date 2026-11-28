import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import { messagesKey } from "./use-messages";
import { repliesKey } from "./use-replies";

describe("repliesKey", () => {
  // The channel socket and every message mutation invalidate messagesKey, so
  // a new reply refreshes an open thread and its parent's count together.
  it("is refreshed by an invalidation of the channel's messages", async () => {
    const client = new QueryClient();
    client.setQueryData(repliesKey("ws", "channel-1", "message-1"), []);
    client.setQueryData(repliesKey("ws", "channel-2", "message-2"), []);

    await client.invalidateQueries({
      queryKey: messagesKey("ws", "channel-1"),
    });

    const state = (channelId: string, messageId: string) =>
      client.getQueryState(repliesKey("ws", channelId, messageId));
    expect(state("channel-1", "message-1")?.isInvalidated).toBe(true);
    expect(state("channel-2", "message-2")?.isInvalidated).toBe(false);
  });
});
