import { asc, eq } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";
import "../../apps/api/src/activity";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents } from "../../apps/api/src/events";
import assignLabelToTask from "../../apps/api/src/label/controllers/assign-label-to-task";
import unassignLabelFromTask from "../../apps/api/src/label/controllers/unassign-label-from-task";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import updateTaskCycle from "../../apps/api/src/task/controllers/update-task-cycle";
import createTaskRelation from "../../apps/api/src/task-relation/controllers/create-task-relation";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function setup() {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const task = async (number: number) =>
    (
      await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: `Task ${number}`,
          status: "to-do",
          priority: "low",
          number,
          position: number,
        })
        .returning()
    )[0];
  const history = async (taskId: string, type: string) => {
    await settleEvents();
    return db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, taskId))
      .orderBy(asc(schema.activityTable.createdAt))
      .then((rows) => rows.filter((row) => row.type === type));
  };
  return { user, workspace, project, task, history };
}

it("records cycle moves with the cycle numbers and the actor", async () => {
  const { user, project, task, history } = await setup();
  const [eight, nine] = await db
    .insert(schema.cycleTable)
    .values(
      [8, 9].map((number) => ({
        projectId: project.id,
        number,
        startsAt: new Date("2030-01-01"),
        endsAt: new Date("2030-01-15"),
      })),
    )
    .returning();
  const { id } = await task(1);

  await updateTaskCycle({ id, cycleId: eight.id, currentUserId: user.id });
  await updateTaskCycle({ id, cycleId: eight.id, currentUserId: user.id });
  await updateTaskCycle({ id, cycleId: nine.id, currentUserId: user.id });
  await updateTaskCycle({ id, cycleId: null, currentUserId: user.id });

  expect(
    (await history(id, "cycle_changed")).map((row) => [
      row.userId,
      row.eventData,
    ]),
  ).toEqual([
    [user.id, { fromCycle: null, toCycle: 8 }],
    [user.id, { fromCycle: 8, toCycle: 9 }],
    [user.id, { fromCycle: 9, toCycle: null }],
  ]);
});

it("records label additions and removals from single and bulk edits", async () => {
  const { user, workspace, task, history } = await setup();
  const [label] = await db
    .insert(schema.labelTable)
    .values({ name: "infra", color: "blue", workspaceId: workspace.id })
    .returning();
  const single = await task(1);
  const bulk = await task(2);

  const assigned = await assignLabelToTask(label.id, single.id, user.id);
  await unassignLabelFromTask(assigned.id, user.id);
  await bulkUpdateTasks({
    taskIds: [bulk.id],
    operation: "addLabel",
    value: label.id,
    userId: user.id,
  });

  expect(
    (await history(single.id, "labels_changed")).map((row) => row.eventData),
  ).toEqual([{ addedLabels: ["infra"] }, { removedLabels: ["infra"] }]);
  expect(
    (await history(bulk.id, "labels_changed")).map((row) => row.eventData),
  ).toEqual([{ addedLabels: ["infra"] }]);
});

it("records the parent issue on the subtask", async () => {
  const { user, workspace, project, task, history } = await setup();
  const parent = await task(1);
  const child = await task(2);

  await createTaskRelation({
    sourceTaskId: parent.id,
    targetTaskId: child.id,
    relationType: "subtask",
    userId: user.id,
    workspaceId: workspace.id,
  });

  expect(
    (await history(child.id, "parent_changed")).map((row) => row.eventData),
  ).toEqual([
    { fromParent: null, toParent: `${project.slug.toUpperCase()}-1` },
  ]);
  expect(await history(parent.id, "parent_changed")).toEqual([]);
});
