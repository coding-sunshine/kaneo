import { and, asc, eq, sql } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  projectTriageResponsibleTable,
  taskTable,
} from "../database/schema";
import { subscribeToEvent } from "../events";
import createNotification from "../notification/controllers/create-notification";
import updateTaskAssignee from "../task/controllers/update-task-assignee";

/**
 * Linear's triage responsibility: a task entering triage notifies the people
 * responsible, or goes to the one who was assigned longest ago. People who
 * cannot take the issue (no team access) are skipped.
 */
export async function routeTriageTask(taskId: string, actorId?: string | null) {
  const [task] = await db
    .select({
      title: taskTable.title,
      projectId: taskTable.projectId,
      userId: taskTable.userId,
      creatorId: taskTable.creatorId,
      status: taskTable.status,
      mode: projectTable.triageResponsibilityMode,
      teamName: projectTable.name,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!task || task.status !== "triage") return;

  const responsible = await db
    .select({ userId: projectTriageResponsibleTable.userId })
    .from(projectTriageResponsibleTable)
    .where(eq(projectTriageResponsibleTable.projectId, task.projectId))
    // ponytail: concurrent triage issues can pick the same person; add a row lock if it matters.
    .orderBy(
      sql`${projectTriageResponsibleTable.lastAssignedAt} asc nulls first`,
      asc(projectTriageResponsibleTable.userId),
    );
  if (responsible.length === 0) return;

  if (task.mode === "assign") {
    if (task.userId) return;
    for (const { userId } of responsible) {
      try {
        await updateTaskAssignee({
          id: taskId,
          userId,
          currentUserId: actorId ?? task.creatorId ?? userId,
        });
      } catch {
        continue;
      }
      await db
        .update(projectTriageResponsibleTable)
        .set({ lastAssignedAt: new Date() })
        .where(
          and(
            eq(projectTriageResponsibleTable.projectId, task.projectId),
            eq(projectTriageResponsibleTable.userId, userId),
          ),
        );
      return;
    }
    return;
  }

  for (const { userId } of responsible) {
    if (userId === actorId) continue;
    await createNotification({
      userId,
      type: "team_issue_triage",
      eventData: {
        taskTitle: task.title,
        teamName: task.teamName,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }
}

subscribeToEvent<{ taskId: string; currentUserId?: string }>(
  "task.created",
  ({ taskId, currentUserId }) => routeTriageTask(taskId, currentUserId),
);
subscribeToEvent<{
  taskId: string;
  oldStatus: string;
  newStatus: string;
  userId?: string | null;
}>("task.status_changed", ({ taskId, oldStatus, newStatus, userId }) =>
  newStatus === "triage" && oldStatus !== "triage"
    ? routeTriageTask(taskId, userId)
    : Promise.resolve(),
);
subscribeToEvent<{ taskId: string; userId?: string; newStatus: string }>(
  "task.moved",
  ({ taskId, userId, newStatus }) =>
    newStatus === "triage"
      ? routeTriageTask(taskId, userId)
      : Promise.resolve(),
);
