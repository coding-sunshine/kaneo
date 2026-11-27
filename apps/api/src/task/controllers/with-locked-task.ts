import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";

type TaskTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function withLockedTask<T>(
  id: string,
  mutate: (
    tx: TaskTransaction,
    before: typeof taskTable.$inferSelect,
  ) => Promise<T>,
  options: { lockTeam?: boolean } = {},
) {
  return db.transaction(async (tx) => {
    // A change that depends on who can open the team holds the team row
    // first, the order a privacy change takes too, so it either waits for
    // that change or makes it wait.
    const [team] = options.lockTeam
      ? await tx
          .select({ id: projectTable.id })
          .from(projectTable)
          .where(
            sql`${projectTable.id} = (SELECT project_id FROM task WHERE id = ${id})`,
          )
          .for("key share")
      : [];
    const [before] = await tx
      .select()
      .from(taskTable)
      .where(eq(taskTable.id, id))
      .for("update");
    if (!before) throw new HTTPException(404, { message: "Task not found" });
    if (options.lockTeam && before.projectId !== team?.id) {
      throw new HTTPException(409, {
        message: "The task moved to another team. Try again.",
      });
    }
    return { before, after: await mutate(tx, before) };
  });
}
