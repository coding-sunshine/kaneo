import { describe, expect, it, vi } from "vite-plus/test";
import { buildAgentTools, CHAT_OFFERED_WRITES } from "../tools";
import { fieldDiff } from "./field-diff";
import { PROJECT_UPDATE_TOOL } from "./project-update-tool";

const fakeClient = () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  return {
    calls,
    client: {
      async json<T>(path: string, init?: RequestInit) {
        calls.push({ path, init });
        return { id: "upd-1" } as T;
      },
    },
  };
};

const draft = JSON.stringify({
  workProjectId: "wp-1",
  health: "atRisk",
  body: "Search slipped a week.",
  reason: "Weekly summary",
});

describe("create_project_update", () => {
  it("is offered only when a loop enables it, next to the project list", () => {
    const { client } = fakeClient();
    const names = (writes?: string[]) =>
      buildAgentTools(client, writes).definitions.map((d) => d.function.name);
    expect(names()).not.toContain(PROJECT_UPDATE_TOOL);
    expect(names([PROJECT_UPDATE_TOOL])).toContain(PROJECT_UPDATE_TOOL);
    expect(names()).toContain("list_work_projects");
  });

  it("is not offered in a chat, only to loops", () => {
    expect(CHAT_OFFERED_WRITES).not.toContain(PROJECT_UPDATE_TOOL);
    expect(CHAT_OFFERED_WRITES).toContain("change_task");
  });

  it("is never posted by the agent: without a proposer it is refused", async () => {
    const { client, calls } = fakeClient();
    const tools = buildAgentTools(client, [PROJECT_UPDATE_TOOL]);
    expect(await tools.call(PROJECT_UPDATE_TOOL, draft)).toContain("error");
    expect(calls).toEqual([]);
  });

  it("becomes a proposal in a loop, while the loop's other writes still run", async () => {
    const { client, calls } = fakeClient();
    const propose = vi.fn(async () => '{"status":"pending"}');
    const tools = buildAgentTools(
      client,
      [PROJECT_UPDATE_TOOL, "create_task_comment"],
      propose,
      [PROJECT_UPDATE_TOOL],
    );
    expect(await tools.call(PROJECT_UPDATE_TOOL, draft)).toContain("pending");
    expect(propose).toHaveBeenCalledWith({
      tool: PROJECT_UPDATE_TOOL,
      args: {
        workProjectId: "wp-1",
        health: "atRisk",
        body: "Search slipped a week.",
      },
      reason: "Weekly summary",
      sources: [],
    });
    expect(calls).toEqual([]);
    await tools.call(
      "create_task_comment",
      JSON.stringify({ taskId: "t1", content: "Noted" }),
    );
    expect(calls).toHaveLength(1);
    expect(propose).toHaveBeenCalledTimes(1);
  });

  it("posts the update when a person accepts it", async () => {
    const { client, calls } = fakeClient();
    const tools = buildAgentTools(client, [PROJECT_UPDATE_TOOL]);
    const result = await tools.run(PROJECT_UPDATE_TOOL, {
      workProjectId: "wp-1",
      health: "atRisk",
      body: "Search slipped a week.",
    });
    expect(result.isError).toBe(false);
    expect(calls[0]?.path).toBe("/api/work-project/wp-1/update");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      health: "atRisk",
      body: "Search slipped a week.",
    });
  });

  it("shows the draft's health and text on the card", () => {
    expect(
      fieldDiff(
        PROJECT_UPDATE_TOOL,
        { workProjectId: "wp-1", health: "atRisk", body: "Slipped." },
        null,
      ),
    ).toEqual([
      { field: "project", from: null, to: "wp-1" },
      { field: "health", from: null, to: "atRisk" },
      { field: "update", from: null, to: "Slipped." },
    ]);
  });
});
