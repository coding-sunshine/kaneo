import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
  cycleTable,
  labelTable,
  projectTable,
  taskDesignReviewTable,
  taskSubscriberTable,
  taskTable,
} from "../../database/schema";
import { designReviewSlaDueAt } from "../../design-review/sla";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { taskIsUnfinished } from "../task-is-unfinished";
import { loadOpenBlockers } from "./load-open-blockers";

// Home and My tasks render this list whole, so it stays one bounded page.
export const ASSIGNED_TASKS_LIMIT = 100;

const priorityRank = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

export type MyTasksTab =
  | "assigned"
  | "created"
  | "subscribed"
  | "activity"
  | "review";

async function getAssignedTasks(
  workspaceId: string,
  userId: string,
  countOnly = false,
  tab: MyTasksTab = "assigned",
) {
  const isActivity = tab === "activity";
  const now = new Date();
  const isReview = tab === "review";
  // The caller's pending design review on the task, for the review tab.
  const pendingReviewAt = sql<Date | null>`(select ${taskDesignReviewTable.requestedAt} from ${taskDesignReviewTable} where ${taskDesignReviewTable.taskId} = ${taskTable.id} and ${taskDesignReviewTable.reviewerId} = ${userId} and ${taskDesignReviewTable.status} = 'pending')`;
  const relation = isReview
    ? sql`${pendingReviewAt} is not null`
    : isActivity
      ? sql`exists (select 1 from ${activityTable} where ${activityTable.taskId} = ${taskTable.id} and ${activityTable.userId} = ${userId})`
      : tab === "created"
        ? eq(taskTable.creatorId, userId)
        : tab === "subscribed"
          ? sql`exists (select 1 from ${taskSubscriberTable} where ${taskSubscriberTable.taskId} = ${taskTable.id} and ${taskSubscriberTable.userId} = ${userId})`
          : eq(taskTable.userId, userId);

  const openAndMine = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    relation,
    ne(taskTable.status, "archived"),
    isNull(taskTable.archivedAt),
    isActivity ? sql`true` : taskIsUnfinished,
    projectAccessCondition(userId, projectTable.id),
  );

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(openAndMine);

  if (countOnly) {
    const [totals] = await totalsQuery;
    return { tasks: [], total: Number(totals?.total ?? 0) };
  }

  // Existing databases may contain duplicate slugs from concurrent column
  // creation. A lateral lookup must return at most one decoration per task.
  const statusColumn = db
    .select({ name: columnTable.name, icon: columnTable.icon })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, taskTable.projectId),
        eq(columnTable.slug, taskTable.status),
      ),
    )
    .orderBy(
      sql`case when ${columnTable.id} = ${taskTable.columnId} then 0 else 1 end`,
      asc(columnTable.position),
      asc(columnTable.createdAt),
      asc(columnTable.id),
    )
    .limit(1)
    .as("assigned_status_column");

  const [tasks, [totals]] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        number: taskTable.number,
        title: taskTable.title,
        status: taskTable.status,
        statusName: statusColumn.name,
        statusIcon: statusColumn.icon,
        priority: taskTable.priority,
        dueDate: taskTable.dueDate,
        position: taskTable.position,
        inCycle: sql<boolean>`exists ${db
          .select({ one: sql`1` })
          .from(cycleTable)
          .where(
            and(
              eq(cycleTable.id, taskTable.cycleId),
              lte(cycleTable.startsAt, now),
              gt(cycleTable.endsAt, now),
              isNull(cycleTable.completedAt),
            ),
          )}`,
        lastActivityAt: isActivity
          ? sql<Date | null>`(select max(${activityTable.createdAt}) from ${activityTable} where ${activityTable.taskId} = ${taskTable.id} and ${activityTable.userId} = ${userId})`.as(
              "last_activity_at",
            )
          : sql<Date | null>`null`.as("last_activity_at"),
        lastActivityType: isActivity
          ? sql<
              string | null
            >`(select ${activityTable.type} from ${activityTable} where ${activityTable.taskId} = ${taskTable.id} and ${activityTable.userId} = ${userId} order by ${activityTable.createdAt} desc limit 1)`
          : sql<string | null>`null`,
        reviewRequestedAt: isReview
          ? pendingReviewAt.as("review_requested_at")
          : sql<Date | null>`null`.as("review_requested_at"),
        workProjectId: taskTable.workProjectId,
        workProjectMilestoneId: taskTable.workProjectMilestoneId,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        projectIcon: projectTable.icon,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoinLateral(statusColumn, sql`true`)
      .where(openAndMine)
      .orderBy(
        ...(isActivity
          ? [sql`last_activity_at desc`]
          : isReview
            ? [sql`review_requested_at asc`]
            : [
                sql`${taskTable.dueDate} asc nulls last`,
                desc(priorityRank),
                asc(taskTable.createdAt),
              ]),
        asc(taskTable.id),
      )
      .limit(ASSIGNED_TASKS_LIMIT),
    totalsQuery,
  ]);

  const labels = tasks.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(
          inArray(
            labelTable.taskId,
            tasks.map((task) => task.id),
          ),
        )
        .orderBy(asc(labelTable.name), asc(labelTable.id))
    : [];

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const { taskId, ...label } of labels) {
    if (!taskId) continue;
    const taskLabels = labelsByTask.get(taskId) ?? [];
    taskLabels.push(label);
    labelsByTask.set(taskId, taskLabels);
  }

  const blockedBy = await loadOpenBlockers(
    tasks.map((task) => task.id),
    userId,
  );

  // Raw subselects skip drizzle's timestamp mapping; the column stores UTC.
  const utcDate = (value: Date | null) =>
    value ? new Date(`${String(value).replace(" ", "T")}Z`) : null;

  return {
    tasks: tasks.map((task) => {
      const reviewRequestedAt = utcDate(task.reviewRequestedAt);
      return {
        ...task,
        lastActivityAt: utcDate(task.lastActivityAt),
        reviewRequestedAt,
        reviewSlaDueAt: reviewRequestedAt
          ? designReviewSlaDueAt(reviewRequestedAt)
          : null,
        labels: labelsByTask.get(task.id) ?? [],
        blockedBy: blockedBy.get(task.id) ?? [],
      };
    }),
    total: Number(totals?.total ?? 0),
  };
}

export default getAssignedTasks;
