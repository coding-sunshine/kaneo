import { describe, expect, it, vi } from "vite-plus/test";

const post = vi.hoisted(() => vi.fn());
vi.mock("@kaneo/libs", () => ({
  client: {
    skill: {
      workspace: {
        ":workspaceId": {
          skills: { ":skillId": { run: { stream: { $post: post } } } },
        },
      },
    },
  },
}));
vi.mock("i18next", () => ({ default: { t: (key: string) => key } }));

import { runSkill } from "./skills";

const stream = (...events: object[]) => {
  const encoder = new TextEncoder();
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      // Split mid-event, as the network may.
      controller.enqueue(encoder.encode(text.slice(0, 7)));
      controller.enqueue(encoder.encode(text.slice(7)));
      controller.close();
    },
  });
};

const result = {
  skillName: "blockers",
  bullets: [],
  promptTokens: 1,
  completionTokens: 1,
};

describe("runSkill", () => {
  it("waits through pings for the streamed answer", async () => {
    post.mockResolvedValue({
      ok: true,
      body: stream(
        { type: "ping" },
        { type: "ping" },
        { type: "result", result },
      ),
    });
    await expect(runSkill("w1", "s1", { channelId: "c1" })).resolves.toEqual(
      result,
    );
    expect(post).toHaveBeenCalledWith({
      param: { workspaceId: "w1", skillId: "s1" },
      json: { channelId: "c1" },
    });
  });

  it("fails with the run's status and message, and when the stream ends early", async () => {
    post.mockResolvedValue({
      ok: true,
      body: stream({ type: "error", status: 429, message: "Cap used up" }),
    });
    await expect(
      runSkill("w1", "s1", { channelId: "c1" }),
    ).rejects.toMatchObject({ status: 429, message: "Cap used up" });
    post.mockResolvedValue({ ok: true, body: stream({ type: "ping" }) });
    await expect(runSkill("w1", "s1", { channelId: "c1" })).rejects.toThrow(
      "navigation:chat.skills.interrupted",
    );
  });
});
