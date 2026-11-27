import { createHash } from "node:crypto";
import { and, count, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import db from "../database";
import {
  calendarConnectionTable,
  calendarTaskEventTable,
  projectTable,
  taskTable,
  workspaceUserTable,
} from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";
import {
  getCalendarOAuthClient,
  getClientUrl,
  isAnyCalendarConfigured,
} from "./config";
import {
  type CalendarConnectionRow,
  listConnections,
  withCalendarToken,
} from "./connection";
import { localDate } from "./providers/calendar-dates";
import { CalendarApiError } from "./providers/http";
import { calendarProviders } from "./providers";
import type { EventInput } from "./providers/types";

const BACKFILL_DAYS = 30;
const BACKFILL_LIMIT = 500;

type LinkRow = typeof calendarTaskEventTable.$inferSelect;
type TaskForCalendar = {
  id: string;
  title: string;
  dueDate: Date | null;
  projectId: string;
  workspaceId: string;
  assigneeId: string | null;
  /** The assignee is a member and can open the task's team. */
  visible: boolean;
};

async function loadTask(taskId: string): Promise<TaskForCalendar | null> {
  const [task] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      dueDate: taskTable.dueDate,
      archivedAt: taskTable.archivedAt,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
      assigneeId: taskTable.userId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId));
  if (!task || task.archivedAt || !task.assigneeId || !task.dueDate) {
    return task ? { ...task, visible: false } : null;
  }
  const [member] = await db
    .select({
      allowed: projectAccessCondition(task.assigneeId, task.projectId),
    })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, task.workspaceId),
        eq(workspaceUserTable.userId, task.assigneeId),
      ),
    );
  return { ...task, visible: Boolean(member?.allowed) };
}

/** The live connections a task's due date belongs in. */
async function targetConnections(task: TaskForCalendar | null) {
  if (!task?.visible || !task.assigneeId) return [];
  const rows = await listConnections(task.assigneeId);
  return rows.filter(
    (row) => row.accessToken && getCalendarOAuthClient(row.provider),
  );
}

function taskEventInput(
  task: TaskForCalendar & { dueDate: Date },
  timeZone: string,
): EventInput {
  const day = localDate(task.dueDate, timeZone);
  return {
    title: task.title,
    description: `${getClientUrl()}/dashboard/workspace/${task.workspaceId}/project/${task.projectId}/task/${task.id}`,
    allDay: true,
    start: day,
    end: day,
  };
}

async function removeLink(link: LinkRow, connection?: CalendarConnectionRow) {
  if (connection) {
    try {
      await withCalendarToken(connection, (token) =>
        calendarProviders[connection.provider].deleteEvent(
          token,
          link.externalEventId,
        ),
      );
    } catch (error) {
      console.error("Calendar sync could not remove a due-date event", error);
    }
  }
  await db
    .delete(calendarTaskEventTable)
    .where(eq(calendarTaskEventTable.id, link.id));
}

async function writeTask(
  connection: CalendarConnectionRow,
  task: TaskForCalendar & { dueDate: Date },
  link: LinkRow | undefined,
) {
  const provider = calendarProviders[connection.provider];
  const input = taskEventInput(task, connection.timeZone);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  if (link?.fingerprint === fingerprint) return;
  const result = await withCalendarToken(connection, async (token) => {
    if (link) {
      try {
        await provider.updateEvent(token, link.externalEventId, input);
        return link.externalEventId;
      } catch (error) {
        // Deleted in the calendar: write it again, the task still has a date.
        if (
          !(error instanceof CalendarApiError) ||
          (error.status !== 404 && error.status !== 410)
        ) {
          throw error;
        }
      }
    }
    return (await provider.createEvent(token, input)).id;
  });
  if (!result.ok) return;
  await db
    .insert(calendarTaskEventTable)
    .values({
      connectionId: connection.id,
      taskId: task.id,
      externalEventId: result.value,
      fingerprint,
    })
    .onConflictDoUpdate({
      target: [
        calendarTaskEventTable.connectionId,
        calendarTaskEventTable.taskId,
      ],
      set: { externalEventId: result.value, fingerprint },
    });
}

async function reconcileNow(taskId: string) {
  const [links, task] = await Promise.all([
    db
      .select()
      .from(calendarTaskEventTable)
      .where(eq(calendarTaskEventTable.taskId, taskId)),
    loadTask(taskId),
  ]);
  const targets = await targetConnections(task);
  if (links.length === 0 && targets.length === 0) return;

  const stale = links.filter(
    (link) => !targets.some((target) => target.id === link.connectionId),
  );
  if (stale.length > 0) {
    const owners = await db
      .select()
      .from(calendarConnectionTable)
      .where(
        inArray(
          calendarConnectionTable.id,
          stale.map((link) => link.connectionId),
        ),
      );
    for (const link of stale) {
      await removeLink(
        link,
        owners.find((owner) => owner.id === link.connectionId),
      );
    }
  }
  if (!task?.dueDate) return;
  for (const connection of targets) {
    await writeTask(
      connection,
      { ...task, dueDate: task.dueDate },
      links.find((link) => link.connectionId === connection.id),
    );
  }
}

// One mutation publishes several task events. Running a task's reconciles one
// after another keeps the second from writing a duplicate event.
const queues = new Map<string, Promise<void>>();

/** Makes the calendars match the task: write, move or remove its event. */
export function reconcileTask(taskId: string): Promise<void> {
  if (!isAnyCalendarConfigured()) return Promise.resolve();
  const run = (queues.get(taskId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => reconcileNow(taskId));
  queues.set(taskId, run);
  void run
    .finally(() => {
      if (queues.get(taskId) === run) queues.delete(taskId);
    })
    .catch(() => undefined);
  return run;
}

/** Re-checks every task with an event in a team or workspace, after access changed. */
export async function reconcileLinkedTasks(
  scope: { projectId: string } | { workspaceId: string },
) {
  if (!isAnyCalendarConfigured()) return;
  const rows = await db
    .selectDistinct({ taskId: calendarTaskEventTable.taskId })
    .from(calendarTaskEventTable)
    .innerJoin(taskTable, eq(taskTable.id, calendarTaskEventTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      "projectId" in scope
        ? eq(taskTable.projectId, scope.projectId)
        : eq(projectTable.workspaceId, scope.workspaceId),
    );
  for (const row of rows) await reconcileTask(row.taskId);
}

/**
 * Writes the person's upcoming assigned due dates and removes events for tasks
 * that no longer belong. Returns how many tasks have an event afterwards.
 */
export async function syncUserTasks(userId: string) {
  const connections = await listConnections(userId);
  const connectionIds = connections.map((row) => row.id);
  if (connectionIds.length === 0) return 0;

  const since = new Date(Date.now() - BACKFILL_DAYS * 86_400_000);
  const [assigned, linked] = await Promise.all([
    db
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.userId, userId),
          isNotNull(taskTable.dueDate),
          gte(taskTable.dueDate, since),
          isNull(taskTable.archivedAt),
        ),
      )
      .orderBy(taskTable.dueDate)
      .limit(BACKFILL_LIMIT),
    db
      .selectDistinct({ id: calendarTaskEventTable.taskId })
      .from(calendarTaskEventTable)
      .where(inArray(calendarTaskEventTable.connectionId, connectionIds)),
  ]);
  const taskIds = new Set([...assigned, ...linked].map((row) => row.id));
  for (const taskId of taskIds) await reconcileTask(taskId);

  const [result] = await db
    .select({ synced: count() })
    .from(calendarTaskEventTable)
    .where(inArray(calendarTaskEventTable.connectionId, connectionIds));
  return result?.synced ?? 0;
}

/** The ids of events written for tasks, so lists do not show them twice. */
export async function linkedEventKeys(connectionIds: string[]) {
  if (connectionIds.length === 0) return new Set<string>();
  const rows = await db
    .select({
      connectionId: calendarTaskEventTable.connectionId,
      externalEventId: calendarTaskEventTable.externalEventId,
    })
    .from(calendarTaskEventTable)
    .where(inArray(calendarTaskEventTable.connectionId, connectionIds));
  return new Set(
    rows.map((row) => `${row.connectionId}:${row.externalEventId}`),
  );
}

/** Removes every due-date event a connection wrote, then the connection. */
export async function removeConnection(connection: CalendarConnectionRow) {
  const links = await db
    .select()
    .from(calendarTaskEventTable)
    .where(eq(calendarTaskEventTable.connectionId, connection.id));
  for (const link of links) await removeLink(link, connection);
  await db
    .delete(calendarConnectionTable)
    .where(eq(calendarConnectionTable.id, connection.id));
}
