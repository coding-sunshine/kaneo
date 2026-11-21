import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  taskTable,
  workProjectMemberTable,
  workProjectMilestoneTable,
  workProjectTable,
  workProjectTeamTable,
} from "../../database/schema";

// Linear's progress: completed issues out of all issues, canceled ones excluded.
const countedTasks = and(
  isNull(taskTable.archivedAt),
  ne(taskTable.status, "archived"),
  ne(taskTable.status, "canceled"),
);

async function progressBy(
  column:
    | typeof taskTable.workProjectId
    | typeof taskTable.workProjectMilestoneId,
  ids: string[],
) {
  const out = new Map<string, { total: number; done: number }>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      id: column,
      total: sql<number>`count(*)::int`,
      done: sql<number>`(count(*) filter (where ${taskTable.status} = 'done'))::int`,
    })
    .from(taskTable)
    .where(and(inArray(column, ids), countedTasks))
    .groupBy(column);
  for (const row of rows)
    if (row.id) out.set(row.id, { total: row.total, done: row.done });
  return out;
}

const noProgress = { total: 0, done: 0 };

export async function loadWorkProjects(
  where: ReturnType<typeof eq>,
  teamId?: string,
) {
  const rows = await db
    .select()
    .from(workProjectTable)
    .where(
      teamId
        ? and(
            where,
            sql`exists (select 1 from ${workProjectTeamTable} where ${workProjectTeamTable.workProjectId} = ${workProjectTable.id} and ${workProjectTeamTable.projectId} = ${teamId})`,
          )
        : where,
    )
    .orderBy(asc(workProjectTable.createdAt), asc(workProjectTable.id));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [teams, members, progress] = await Promise.all([
    db
      .select()
      .from(workProjectTeamTable)
      .where(inArray(workProjectTeamTable.workProjectId, ids)),
    db
      .select()
      .from(workProjectMemberTable)
      .where(inArray(workProjectMemberTable.workProjectId, ids)),
    progressBy(taskTable.workProjectId, ids),
  ]);

  return rows.map((row) => ({
    ...row,
    teamIds: teams
      .filter((t) => t.workProjectId === row.id)
      .map((t) => t.projectId),
    memberIds: members
      .filter((m) => m.workProjectId === row.id)
      .map((m) => m.userId),
    progress: progress.get(row.id) ?? noProgress,
  }));
}

export async function loadWorkProjectDetail(id: string) {
  const [project] = await loadWorkProjects(eq(workProjectTable.id, id));
  if (!project) throw new HTTPException(404, { message: "Project not found" });
  const milestones = await db
    .select()
    .from(workProjectMilestoneTable)
    .where(eq(workProjectMilestoneTable.workProjectId, id))
    .orderBy(
      asc(workProjectMilestoneTable.sortOrder),
      asc(workProjectMilestoneTable.createdAt),
      asc(workProjectMilestoneTable.id),
    );
  const progress = await progressBy(
    taskTable.workProjectMilestoneId,
    milestones.map((m) => m.id),
  );
  return {
    ...project,
    milestones: milestones.map((m) => ({
      ...m,
      progress: progress.get(m.id) ?? noProgress,
    })),
  };
}

export async function loadMilestone(id: string) {
  const [milestone] = await db
    .select()
    .from(workProjectMilestoneTable)
    .where(eq(workProjectMilestoneTable.id, id));
  if (!milestone)
    throw new HTTPException(404, { message: "Milestone not found" });
  const progress = await progressBy(taskTable.workProjectMilestoneId, [id]);
  return { ...milestone, progress: progress.get(id) ?? noProgress };
}
