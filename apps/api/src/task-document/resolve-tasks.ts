import { and, eq, inArray, or } from "drizzle-orm";
import type db from "../database";
import { projectTable, taskTable } from "../database/schema";
import { isSameProjectKey } from "../project/project-key";
import type { TaskReferences } from "./find-links";

type Database = Pick<typeof db, "select">;

/** The ids of the issues of one workspace that a text's references name. */
export async function resolveTaskReferences(
  database: Database,
  workspaceId: string,
  { ids, keys }: TaskReferences,
) {
  const projects = keys.length
    ? await database
        .select({ id: projectTable.id, slug: projectTable.slug })
        .from(projectTable)
        .where(eq(projectTable.workspaceId, workspaceId))
    : [];
  const numbered = keys.flatMap(({ key, number }) => {
    const named = projects.filter((project) =>
      isSameProjectKey(project.slug, key),
    );
    // A key two teams answer to names neither.
    return named.length === 1 && named[0]
      ? [
          and(
            eq(taskTable.projectId, named[0].id),
            eq(taskTable.number, number),
          ),
        ]
      : [];
  });
  if (!ids.length && !numbered.length) return [];
  const tasks = await database
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        or(ids.length ? inArray(taskTable.id, ids) : undefined, ...numbered),
      ),
    );
  return tasks.map((task) => task.id);
}
