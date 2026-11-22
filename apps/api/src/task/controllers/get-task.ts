import { boundedTaskRead } from "../bounded-read";
import { alias } from "drizzle-orm/pg-core";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { isSubtask } from "../is-subtask";
import { getSubtaskCounts } from "../get-subtask-counts";
import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  taskTable,
  userTable,
  projectTable,
  taskRelationTable,
  taskSubscriberTable,
} from "../../database/schema";

async function getTask(taskId: string, board = false, userId?: string) {
  const task = await db
    .select({
      id: taskTable.id,
      isSubtask,
      title: taskTable.title,
      number: taskTable.number,
      description: board ? boardDescription : taskTable.description,
      ...(board
        ? {
            descriptionDeferred,
          }
        : {}),
      status: taskTable.status,
      columnId: taskTable.columnId,
      priority: taskTable.priority,
      estimate: taskTable.estimate,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      slaDueAt: taskTable.slaDueAt,
      recurrence: taskTable.recurrence,
      position: taskTable.position,
      archivedAt: taskTable.archivedAt,
      createdAt: taskTable.createdAt,
      creatorId: taskTable.creatorId,
      workProjectId: taskTable.workProjectId,
      workProjectMilestoneId: taskTable.workProjectMilestoneId,
      cycleId: taskTable.cycleId,
      snoozedUntil: taskTable.snoozedUntil,
      isSubscribed: userId
        ? sql<boolean>`exists (select 1 from ${taskSubscriberTable} where ${taskSubscriberTable.taskId} = ${taskTable.id} and ${taskSubscriberTable.userId} = ${userId})`
        : sql<boolean>`false`,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      projectId: taskTable.projectId,
      workspaceId: sql<string>`(select ${projectTable.workspaceId} from ${projectTable} where ${projectTable.id} = ${taskTable.projectId})`,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task.length || !task[0]) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (!board) return task[0];
  const { workspaceId, ...result } = task[0];
  if (!workspaceId) return result;
  const parent = alias(taskTable, "parent");
  const parents = await db
    .selectDistinct({ id: parent.id })
    .from(taskRelationTable)
    .innerJoin(parent, eq(taskRelationTable.sourceTaskId, parent.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
        eq(parent.projectId, result.projectId),
      ),
    );
  const counts = await boundedTaskRead((tx) =>
    getSubtaskCounts(
      tx,
      [taskId, ...parents.map((task) => task.id)],
      workspaceId,
      false,
      userId,
    ),
  );
  return {
    ...result,
    subtaskCounts: counts.get(taskId) ?? { completed: 0, total: 0 },
    parentSubtaskCounts: parents.map(({ id }) => ({
      taskId: id,
      ...(counts.get(id) ?? { completed: 0, total: 0 }),
    })),
  };
}

export default getTask;
