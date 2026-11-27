import { asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  initiativeTable,
  initiativeUpdateTable,
  initiativeWorkProjectTable,
  workProjectTable,
} from "../../database/schema";
import { loadWorkProjects } from "../../work-project/controllers/load-work-projects";
import { rollUpHealth, rollUpProgress } from "../roll-up";

async function latestHealth(ids: string[]) {
  const rows = await db
    .selectDistinctOn([initiativeUpdateTable.initiativeId], {
      initiativeId: initiativeUpdateTable.initiativeId,
      health: initiativeUpdateTable.health,
    })
    .from(initiativeUpdateTable)
    .where(inArray(initiativeUpdateTable.initiativeId, ids))
    .orderBy(
      initiativeUpdateTable.initiativeId,
      desc(initiativeUpdateTable.createdAt),
      desc(initiativeUpdateTable.id),
    );
  return new Map(rows.map((row) => [row.initiativeId, row.health]));
}

async function load(where: SQL, userId: string) {
  const rows = await db
    .select()
    .from(initiativeTable)
    .where(where)
    .orderBy(asc(initiativeTable.createdAt), asc(initiativeTable.id));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [links, health] = await Promise.all([
    db
      .select()
      .from(initiativeWorkProjectTable)
      .where(inArray(initiativeWorkProjectTable.initiativeId, ids)),
    latestHealth(ids),
  ]);
  const projectIds = [...new Set(links.map((link) => link.workProjectId))];
  // Progress leaves out issues in teams the reader cannot open.
  const projects = projectIds.length
    ? await loadWorkProjects(inArray(workProjectTable.id, projectIds), userId)
    : [];

  return rows.map((row) => {
    const own = links
      .filter((link) => link.initiativeId === row.id)
      .map((link) => link.workProjectId);
    const workProjects = projects.filter((project) => own.includes(project.id));
    const ownHealth = health.get(row.id) ?? null;
    return {
      ...row,
      workProjectIds: own,
      health: rollUpHealth(ownHealth, []),
      // A project whose teams are all closed to the reader does not speak
      // for the initiative to them.
      rolledUpHealth: rollUpHealth(
        ownHealth,
        workProjects.filter((project) => project.canOpenDocuments),
      ),
      progress: rollUpProgress(workProjects),
      workProjects,
    };
  });
}

export async function loadInitiatives(workspaceId: string, userId: string) {
  const rows = await load(eq(initiativeTable.workspaceId, workspaceId), userId);
  return rows.map(({ workProjects: _, ...row }) => row);
}

export async function loadInitiativeDetail(id: string, userId: string) {
  const [initiative] = await load(eq(initiativeTable.id, id), userId);
  if (!initiative)
    throw new HTTPException(404, { message: "Initiative not found" });
  return initiative;
}
