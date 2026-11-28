import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  taskTable,
  workProjectDependencyTable,
  workProjectLabelTable,
  workProjectMemberTable,
  workProjectMilestoneTable,
  workProjectTable,
  workProjectTeamTable,
} from "../../database/schema";
import { workProjectDocumentAccess } from "../../document/visibility";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { listProjectLinks } from "./work-project-links";
import { loadPortfolioSignals } from "./portfolio-signals";

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
  userId: string,
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
    // Issues in a team the reader cannot open are not counted for them.
    .where(
      and(
        inArray(column, ids),
        countedTasks,
        projectAccessCondition(userId, taskTable.projectId),
      ),
    )
    .groupBy(column);
  for (const row of rows)
    if (row.id) out.set(row.id, { total: row.total, done: row.done });
  return out;
}

const noProgress = { total: 0, done: 0 };

export async function loadWorkProjects(
  where: ReturnType<typeof eq>,
  userId: string,
  teamId?: string,
) {
  const rows = await db
    .select({
      ...getTableColumns(workProjectTable),
      // Counts the teams the reader cannot open, which `teamIds` leaves out.
      canOpenDocuments: workProjectDocumentAccess(userId, workProjectTable.id),
    })
    .from(workProjectTable)
    .where(
      teamId
        ? and(
            where,
            sql`exists (select 1 from ${workProjectTeamTable} where ${workProjectTeamTable.workProjectId} = ${workProjectTable.id} and ${workProjectTeamTable.projectId} = ${teamId} and ${projectAccessCondition(userId, workProjectTeamTable.projectId)})`,
          )
        : where,
    )
    .orderBy(asc(workProjectTable.createdAt), asc(workProjectTable.id));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [teams, members, labels, dependencies, progress, signals] =
    await Promise.all([
      db
        .select()
        .from(workProjectTeamTable)
        // A team the reader cannot open is not named.
        .where(
          and(
            inArray(workProjectTeamTable.workProjectId, ids),
            projectAccessCondition(userId, workProjectTeamTable.projectId),
          ),
        ),
      db
        .select()
        .from(workProjectMemberTable)
        .where(inArray(workProjectMemberTable.workProjectId, ids)),
      db
        .select()
        .from(workProjectLabelTable)
        .where(inArray(workProjectLabelTable.workProjectId, ids)),
      db
        .select()
        .from(workProjectDependencyTable)
        .where(
          or(
            inArray(workProjectDependencyTable.workProjectId, ids),
            inArray(workProjectDependencyTable.dependsOnId, ids),
          ),
        )
        .orderBy(asc(workProjectDependencyTable.createdAt)),
      progressBy(taskTable.workProjectId, ids, userId),
      loadPortfolioSignals(ids, userId),
    ]);

  return rows.map((row) => ({
    ...row,
    teamIds: teams
      .filter((t) => t.workProjectId === row.id)
      .map((t) => t.projectId),
    memberIds: members
      .filter((m) => m.workProjectId === row.id)
      .map((m) => m.userId),
    labelIds: labels
      .filter((l) => l.workProjectId === row.id)
      .map((l) => l.labelId),
    dependsOnIds: dependencies
      .filter((d) => d.workProjectId === row.id)
      .map((d) => d.dependsOnId),
    dependentIds: dependencies
      .filter((d) => d.dependsOnId === row.id)
      .map((d) => d.workProjectId),
    progress: progress.get(row.id) ?? noProgress,
    ...signals(row.id),
  }));
}

export async function loadWorkProjectDetail(id: string, userId: string) {
  const [project] = await loadWorkProjects(eq(workProjectTable.id, id), userId);
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
    userId,
  );
  return {
    ...project,
    milestones: milestones.map((m) => ({
      ...m,
      progress: progress.get(m.id) ?? noProgress,
    })),
    links: await listProjectLinks(id),
  };
}

export async function loadMilestone(id: string, userId: string) {
  const [milestone] = await db
    .select()
    .from(workProjectMilestoneTable)
    .where(eq(workProjectMilestoneTable.id, id));
  if (!milestone)
    throw new HTTPException(404, { message: "Milestone not found" });
  const progress = await progressBy(
    taskTable.workProjectMilestoneId,
    [id],
    userId,
  );
  return { ...milestone, progress: progress.get(id) ?? noProgress };
}
