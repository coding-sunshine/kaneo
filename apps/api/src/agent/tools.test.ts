import { describe, expect, it } from "vite-plus/test";
import { buildAgentTools, CHAT_WRITE_TOOLS } from "./tools";

describe("buildAgentTools", () => {
  const calls: string[] = [];
  const tools = buildAgentTools({
    async json<T>(path: string) {
      calls.push(path);
      return { ok: true } as T;
    },
  });
  const names = tools.definitions.map((tool) => tool.function.name);

  it("exposes reads and the write allowlist only", () => {
    expect(names).toEqual(
      expect.arrayContaining([
        "whoami",
        "list_tasks",
        "get_task",
        "search",
        "create_task",
        "update_task",
        "update_task_status",
        "update_task_assignee",
        "create_task_comment",
      ]),
    );
    for (const forbidden of ["delete_task", "delete_label", "create_label"]) {
      expect(names).not.toContain(forbidden);
    }
    expect(tools.definitions[0]?.function.parameters).toMatchObject({
      type: "object",
    });
  });

  it("validates arguments and reports unknown tools as errors", async () => {
    expect(await tools.call("delete_task", "{}")).toContain("Unknown tool");
    expect(await tools.call("get_task", "not json")).toContain(
      "not valid JSON",
    );
    expect(await tools.call("get_task", "{}")).toContain("error");
    expect(calls).toEqual([]);
    expect(await tools.call("get_task", '{"taskId":"t1"}')).toContain("ok");
    expect(calls).toHaveLength(1);
  });

  it("offers only the requested write tools", async () => {
    const hits: string[] = [];
    const narrow = buildAgentTools(
      {
        async json<T>(path: string) {
          hits.push(path);
          return {} as T;
        },
      },
      ["create_task_comment"],
    );
    const offered = narrow.definitions.map((tool) => tool.function.name);
    expect(offered).toContain("create_task_comment");
    expect(offered).toContain("list_tasks");
    for (const name of ["update_task", "create_task", "update_task_status"]) {
      expect(offered).not.toContain(name);
      expect(await narrow.call(name, "{}")).toContain("Unknown tool");
    }
    expect(hits).toEqual([]);
  });
});

describe("buildAgentTools with proposals", () => {
  const hits: string[] = [];
  const proposed: unknown[] = [];
  const tools = buildAgentTools(
    {
      async json<T>(path: string) {
        hits.push(path);
        return {} as T;
      },
    },
    CHAT_WRITE_TOOLS,
    async (request) => {
      proposed.push(request);
      return '{"proposalId":"p1"}';
    },
  );
  const byName = (name: string) =>
    tools.definitions.find((tool) => tool.function.name === name);

  it("offers change_task and asks every write for a reason", () => {
    expect(byName("change_task")).toBeDefined();
    for (const name of ["change_task", "update_task", "create_task"]) {
      expect(byName(name)?.function.parameters).toMatchObject({
        required: expect.arrayContaining(["reason"]),
      });
    }
    expect(byName("get_task")?.function.parameters).not.toMatchObject({
      required: expect.arrayContaining(["reason"]),
    });
  });

  it("turns a write into a proposal and never calls the API", async () => {
    const result = await tools.call(
      "change_task",
      JSON.stringify({
        taskId: "t1",
        priority: "high",
        addLabels: ["bug"],
        reason: "Users hit it daily",
        sources: ["task:t1"],
      }),
    );
    expect(result).toContain("p1");
    expect(hits).toEqual([]);
    expect(proposed).toEqual([
      {
        tool: "change_task",
        args: { taskId: "t1", priority: "high", addLabels: ["bug"] },
        reason: "Users hit it daily",
        sources: ["task:t1"],
      },
    ]);
  });

  it("refuses a write without a reason or with bad arguments", async () => {
    proposed.length = 0;
    expect(
      await tools.call("change_task", '{"taskId":"t1","priority":"high"}'),
    ).toContain("reason");
    expect(
      await tools.call(
        "change_task",
        '{"taskId":"t1","priority":"soon","reason":"x"}',
      ),
    ).toContain("error");
    expect(proposed).toEqual([]);
    expect(hits).toEqual([]);
  });

  it("does not offer change_task outside a chat", () => {
    const plain = buildAgentTools({ json: async <T>() => ({}) as T });
    expect(plain.definitions.map((tool) => tool.function.name)).not.toContain(
      "change_task",
    );
  });
});
