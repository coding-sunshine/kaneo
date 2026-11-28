import { and, asc, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  staleItemNudgeTable,
  taskTable,
  userNotificationPreferenceTable,
  workspaceUserTable,
} from "../database/schema";
import {
  dispatchNotification,
  persistNotification,
} from "../notification/controllers/create-notification";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";
import { localWeek } from "./local-week";

export const STALE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Time in status runs from the latest status change. Comments and other edits
// leave it alone; an issue that never moved counts from its creation.
const enteredStatusAt = sql`coalesce((
  SELECT max(status_activity.created_at) FROM activity AS status_activity
  WHERE status_activity.task_id = ${taskTable.id}
    AND status_activity.type = 'status_changed'
), ${taskTable.createdAt})`.mapWith(taskTable.createdAt);

// Started issues (in progress, in review or a custom open column) whose
// assignee can still open them and has not turned the nudge off.
async function staleTasks(now: Date) {
  const cutoff = new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS);
  return db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      ownerId: taskTable.userId,
      projectSlug: projectTable.slug,
      workspaceId: projectTable.workspaceId,
      enteredStatusAt,
      timeZone: userNotificationPreferenceTable.scheduleTimezone,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
        eq(workspaceUserTable.userId, taskTable.userId),
      ),
    )
    .leftJoin(
      userNotificationPreferenceTable,
      eq(userNotificationPreferenceTable.userId, taskTable.userId),
    )
    .where(
      and(
        isNotNull(taskTable.userId),
        isNull(taskTable.archivedAt),
        ne(taskTable.status, "archived"),
        sql`task_status_category(${taskTable.projectId}, ${taskTable.status}) = 'started'`,
        sql`${enteredStatusAt} <= ${cutoff.toISOString()}::timestamp`,
        or(
          isNull(userNotificationPreferenceTable.id),
          eq(userNotificationPreferenceTable.staleItemsEnabled, true),
        ),
        workspaceIsActive(projectTable.workspaceId),
        projectAccessCondition(taskTable.userId, taskTable.projectId),
      ),
    )
    .orderBy(asc(enteredStatusAt));
}

type StaleTask = Awaited<ReturnType<typeof staleTasks>>[number];

type Group = {
  ownerId: string;
  workspaceId: string;
  week: string;
  tasks: StaleTask[];
};

async function nudge({ ownerId, workspaceId, week, tasks }: Group, now: Date) {
  const listed = tasks.map((task) => ({
    id: task.id,
    key: `${task.projectSlug}-${task.number}`,
    title: task.title,
    status: task.status,
    days: Math.floor((now.getTime() - task.enteredStatusAt.getTime()) / DAY_MS),
  }));
  const notification = await db.transaction(async (tx) => {
    // Claim first: of two runs in the same week, one sends.
    const [claimed] = await tx
      .insert(staleItemNudgeTable)
      .values({ userId: ownerId, workspaceId, week })
      .onConflictDoNothing()
      .returning({ id: staleItemNudgeTable.id });
    if (!claimed) return null;
    const issueList = listed
      .map((task) => `${task.key} ${task.title}`)
      .join(", ");
    const created = await persistNotification(
      {
        userId: ownerId,
        type: "stale_items",
        // Content only: clients without this type still show the list, and
        // a null title keeps email and push copy localized.
        content: issueList,
        eventData: {
          workspaceId,
          count: listed.length,
          issueList,
          tasks: listed,
        },
        resourceId: workspaceId,
        resourceType: "workspace",
      },
      tx,
    );
    if (!created)
      await tx
        .delete(staleItemNudgeTable)
        .where(eq(staleItemNudgeTable.id, claimed.id));
    return created;
  });
  if (notification) await dispatchNotification(notification);
}

/** Weekdays only, once a week per owner and workspace, in the owner's timezone. */
export async function checkStaleItemNudges(
  now = new Date(),
): Promise<{ degraded: boolean }> {
  let degraded = false;
  const groups = new Map<string, Group>();
  for (const task of await staleTasks(now)) {
    if (!task.ownerId) continue;
    const { weekend, week } = localWeek(now, task.timeZone ?? "UTC");
    if (weekend) continue;
    const key = `${task.ownerId}:${task.workspaceId}`;
    const group = groups.get(key) ?? {
      ownerId: task.ownerId,
      workspaceId: task.workspaceId,
      week,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    try {
      await nudge(group, now);
    } catch (error) {
      degraded = true;
      console.error("Failed to send a stale item nudge", {
        userId: group.ownerId,
        workspaceId: group.workspaceId,
        error,
      });
    }
  }
  return { degraded };
}
