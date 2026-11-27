import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  workProjectDependencyTable,
  workProjectTable,
} from "../../database/schema";
import { loadWorkProjectDetail } from "./load-work-projects";

const dependency = workProjectDependencyTable;

// Whether `from` already waits on `to`, directly or through other projects.
async function waitsOn(from: string, to: string) {
  const result = await db.execute<{ found: boolean }>(sql`
    with recursive chain(id) as (
      select ${dependency.dependsOnId} from ${dependency}
      where ${dependency.workProjectId} = ${from}
      union
      select d.depends_on_id from ${dependency} d
      join chain on d.work_project_id = chain.id
    )
    select exists (select 1 from chain where id = ${to}) as found
  `);
  return result.rows[0]?.found === true;
}

export async function addProjectDependency(
  id: string,
  dependsOnId: string,
  userId: string,
) {
  if (id === dependsOnId)
    throw new HTTPException(400, {
      message: "A project cannot depend on itself",
    });
  const [project, other] = await Promise.all(
    [id, dependsOnId].map(async (projectId) => {
      const [row] = await db
        .select({ workspaceId: workProjectTable.workspaceId })
        .from(workProjectTable)
        .where(eq(workProjectTable.id, projectId));
      return row;
    }),
  );
  if (!project || !other || other.workspaceId !== project.workspaceId)
    throw new HTTPException(400, {
      message: "Projects must belong to the same workspace",
    });
  if (await waitsOn(dependsOnId, id))
    throw new HTTPException(409, {
      message: "This dependency would make the projects wait on each other",
    });
  await db
    .insert(dependency)
    .values({ workProjectId: id, dependsOnId })
    .onConflictDoNothing();
  return loadWorkProjectDetail(id, userId);
}

export async function removeProjectDependency(
  id: string,
  dependsOnId: string,
  userId: string,
) {
  await db
    .delete(dependency)
    .where(
      and(
        eq(dependency.workProjectId, id),
        eq(dependency.dependsOnId, dependsOnId),
      ),
    );
  return loadWorkProjectDetail(id, userId);
}
