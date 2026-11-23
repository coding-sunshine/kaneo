import { eq } from "drizzle-orm";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";

/** Human ticket id such as ENG-12. */
export async function getTaskIdentifier(taskId: string) {
  const [row] = await db
    .select({ slug: projectTable.slug, number: taskTable.number })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId));
  return row ? `${row.slug.toUpperCase()}-${row.number}` : null;
}
