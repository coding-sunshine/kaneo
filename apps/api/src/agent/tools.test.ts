import { describe, expect, it } from "vite-plus/test";
import { buildAgentTools } from "./tools";

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
