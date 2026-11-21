import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import {
  applyOptimisticBoardPatch,
  rollbackOptimisticBoardPatch,
} from "./optimistic-board-task";

const task = { id: "t1", projectId: "p1", status: "todo", position: 0 };
const board = () =>
  ({
    id: "p1",
    columns: [
      { id: "todo", slug: "todo", tasks: [task] },
      { id: "done", slug: "done", tasks: [] },
    ],
    plannedTasks: [],
    archivedTasks: [],
  }) as never;

describe("optimistic board patch", () => {
  it("moves the task at once and rolls back on error", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["tasks", "p1"], board());
    const ctx = await applyOptimisticBoardPatch(qc, task as never, {
      status: "done",
    });
    const moved = qc.getQueryData<any>(["tasks", "p1"]);
    expect(moved.columns[1].tasks.map((t: any) => t.id)).toEqual(["t1"]);
    expect(moved.columns[0].tasks).toHaveLength(0);
    rollbackOptimisticBoardPatch(qc, ctx);
    const back = qc.getQueryData<any>(["tasks", "p1"]);
    expect(back.columns[0].tasks.map((t: any) => t.id)).toEqual(["t1"]);
  });
});
