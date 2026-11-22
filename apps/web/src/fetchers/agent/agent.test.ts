import { describe, expect, it, vi } from "vite-plus/test";

const post = vi.hoisted(() => vi.fn());
vi.mock("@kaneo/libs", () => ({
  client: {
    agent: {
      workspace: { ":workspaceId": { messages: { stream: { $post: post } } } },
    },
  },
}));

import { type AgentStreamEvent, streamMessage } from "./agent";

describe("streamMessage", () => {
  it("emits events split across network chunks", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        const sse =
          'data: {"type":"chat","chatId":"c1","title":"t"}\n\ndata: {"type":"delta","text":"Hi"}\n\n';
        controller.enqueue(encoder.encode(sse.slice(0, 30)));
        controller.enqueue(encoder.encode(sse.slice(30)));
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });
    post.mockResolvedValue({ ok: true, body });
    const events: AgentStreamEvent[] = [];
    await streamMessage("w1", { message: "hi" }, (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["chat", "delta", "done"]);
    expect(post).toHaveBeenCalledWith({
      param: { workspaceId: "w1" },
      json: { message: "hi" },
    });
  });
});
