import { and, asc, gte, inArray, isNull, lt, max, ne, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  taskTable,
  workProjectMilestoneTable,
  workProjectUpdateTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { taskIsCompleted } from "../../task/task-is-completed";

export type PortfolioSignals = {
  lastUpdateAt: Date | null;
  nextMilestone: { name: string; targetDate: Date } | null;
  overdueCount: number;
};

const noSignals: PortfolioSignals = {
  lastUpdateAt: null,
  nextMilestone: null,
  overdueCount: 0,
};

/** The project list's portfolio columns: last update, next milestone, overdue issues. */
export async function loadPortfolioSignals(ids: string[], userId: string) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [updates, milestones, overdue] = await Promise.all([
    db
      .select({
        id: workProjectUpdateTable.workProjectId,
        at: max(workProjectUpdateTable.createdAt),
      })
      .from(workProjectUpdateTable)
      .where(inArray(workProjectUpdateTable.workProjectId, ids))
      .groupBy(workProjectUpdateTable.workProjectId),
    // The earliest milestone dated today or later.
    db
      .selectDistinctOn([workProjectMilestoneTable.workProjectId], {
        id: workProjectMilestoneTable.workProjectId,
        name: workProjectMilestoneTable.name,
        targetDate: workProjectMilestoneTable.targetDate,
      })
      .from(workProjectMilestoneTable)
      .where(
        and(
          inArray(workProjectMilestoneTable.workProjectId, ids),
          gte(workProjectMilestoneTable.targetDate, startOfToday),
        ),
      )
      .orderBy(
        asc(workProjectMilestoneTable.workProjectId),
        asc(workProjectMilestoneTable.targetDate),
        asc(workProjectMilestoneTable.sortOrder),
      ),
    db
      .select({
        id: taskTable.workProjectId,
        count: sql<number>`count(*)::int`,
      })
      .from(taskTable)
      .where(
        and(
          inArray(taskTable.workProjectId, ids),
          isNull(taskTable.archivedAt),
          ne(taskTable.status, "archived"),
          ne(taskTable.status, "canceled"),
          lt(taskTable.dueDate, now),
          sql`not coalesce((
            select ${columnTable.isFinal} from ${columnTable}
            where ${columnTable.id} = ${taskTable.columnId}
              and ${columnTable.projectId} = ${taskTable.projectId}
          ), ${taskIsCompleted})`,
          // Issues in a team the reader cannot open are not counted for them.
          projectAccessCondition(userId, taskTable.projectId),
        ),
      )
      .groupBy(taskTable.workProjectId),
  ]);

  const out = new Map<string, PortfolioSignals>();
  const entry = (id: string) => {
    const current = out.get(id) ?? { ...noSignals };
    out.set(id, current);
    return current;
  };
  for (const row of updates) entry(row.id).lastUpdateAt = row.at;
  for (const row of milestones)
    if (row.targetDate)
      entry(row.id).nextMilestone = {
        name: row.name,
        targetDate: row.targetDate,
      };
  for (const row of overdue) if (row.id) entry(row.id).overdueCount = row.count;
  return (id: string) => out.get(id) ?? noSignals;
}
