import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

const DAY = 86_400_000;

type UpNextTask = {
  id: string;
  title: string;
  position: number | null;
  inCycle: boolean;
  blockedBy: string[];
  hasHiddenBlocker: boolean;
};

describe("API integration: assigned tasks carry Up next signals", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("marks in-cycle tasks, manual position and open blockers, hiding blockers the reader cannot open", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const workspaceId = owner.workspace.id;
    const web = await createProjectFixture({ workspaceId, slug: "web" });
    const ops = await createProjectFixture({ workspaceId, slug: "ops" });
    const member = await addWorkspaceMember(workspaceId);
    await restrictToProjects(workspaceId, member.id, [web.project.id]);

    const now = Date.now();
    const [current, finished] = await db
      .insert(schema.cycleTable)
      .values([
        {
          projectId: web.project.id,
          number: 1,
          startsAt: new Date(now - 3 * DAY),
          endsAt: new Date(now + 4 * DAY),
        },
        {
          projectId: web.project.id,
          number: 2,
          startsAt: new Date(now - 20 * DAY),
          endsAt: new Date(now - 6 * DAY),
        },
      ])
      .returning();

    const mine = {
      projectId: web.project.id,
      status: "to-do",
      columnId: web.columns.todo.id,
      userId: member.id,
    };
    const [
      inCycle,
      oldCycle,
      blocked,
      hiddenBlocked,
      doneBlocked,
      twiceHidden,
    ] = await db
      .insert(schema.taskTable)
      .values([
        { ...mine, number: 1, title: "In cycle", cycleId: current.id },
        { ...mine, number: 2, title: "Old cycle", cycleId: finished.id },
        { ...mine, number: 3, title: "Blocked", position: 7 },
        { ...mine, number: 4, title: "Blocked by ops" },
        { ...mine, number: 5, title: "Blocker is done" },
        { ...mine, number: 8, title: "Blocked by two ops tasks" },
      ])
      .returning();
    const [webBlocker, opsBlocker, doneBlocker, opsBlocker2] = await db
      .insert(schema.taskTable)
      .values([
        {
          projectId: web.project.id,
          number: 6,
          title: "Web blocker",
          status: "in-progress",
          columnId: web.columns.inProgress.id,
        },
        {
          projectId: ops.project.id,
          number: 1,
          title: "Secret ops work",
          status: "to-do",
          columnId: ops.columns.todo.id,
        },
        {
          projectId: web.project.id,
          number: 7,
          title: "Finished blocker",
          status: "done",
          columnId: web.columns.done.id,
        },
        {
          projectId: ops.project.id,
          number: 2,
          title: "More ops work",
          status: "to-do",
          columnId: ops.columns.todo.id,
        },
      ])
      .returning();
    await db.insert(schema.taskRelationTable).values([
      {
        sourceTaskId: webBlocker.id,
        targetTaskId: blocked.id,
        relationType: "blocks",
      },
      {
        sourceTaskId: opsBlocker.id,
        targetTaskId: hiddenBlocked.id,
        relationType: "blocks",
      },
      {
        sourceTaskId: opsBlocker.id,
        targetTaskId: twiceHidden.id,
        relationType: "blocks",
      },
      {
        sourceTaskId: opsBlocker2.id,
        targetTaskId: twiceHidden.id,
        relationType: "blocks",
      },
      {
        sourceTaskId: doneBlocker.id,
        targetTaskId: doneBlocked.id,
        relationType: "blocks",
      },
      // "related" never blocks.
      {
        sourceTaskId: webBlocker.id,
        targetTaskId: inCycle.id,
        relationType: "related",
      },
    ]);

    mockAuthenticatedSession(member);
    const response = await createApp().app.request(
      `/api/task/assigned?workspaceId=${workspaceId}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { tasks: UpNextTask[] };
    const byId = new Map(body.tasks.map((task) => [task.id, task]));

    expect(byId.get(inCycle.id)).toMatchObject({
      inCycle: true,
      blockedBy: [],
      hasHiddenBlocker: false,
    });
    expect(byId.get(oldCycle.id)?.inCycle).toBe(false);
    expect(byId.get(blocked.id)).toMatchObject({
      position: 7,
      inCycle: false,
      blockedBy: ["web-6"],
      hasHiddenBlocker: false,
    });
    // The reader cannot open ops: the blocker is flagged, never named or counted.
    for (const task of body.tasks)
      expect(task.blockedBy.every((key) => typeof key === "string")).toBe(true);
    const hiddenSignal = (id: string) => {
      const task = byId.get(id);
      return {
        blockedBy: task?.blockedBy,
        hasHiddenBlocker: task?.hasHiddenBlocker,
      };
    };
    expect(hiddenSignal(hiddenBlocked.id)).toEqual({
      blockedBy: [],
      hasHiddenBlocker: true,
    });
    // Two hidden blockers look the same as one.
    expect(hiddenSignal(twiceHidden.id)).toEqual(
      hiddenSignal(hiddenBlocked.id),
    );
    expect(JSON.stringify(body)).not.toContain("Secret ops work");
    expect(JSON.stringify(body)).not.toContain("ops-1");
    expect(JSON.stringify(body)).not.toContain("ops-2");
    expect(hiddenSignal(doneBlocked.id)).toEqual({
      blockedBy: [],
      hasHiddenBlocker: false,
    });
  });
});
