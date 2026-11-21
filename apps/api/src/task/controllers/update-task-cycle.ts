import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { cycleTable, taskTable } from "../../database/schema";

export async function assertCycleInProject(
  projectId: string,
  cycleId: string | null | undefined,
) {
  if (!cycleId) return;
  const [cycle] = await db
    .select({ id: cycleTable.id })
    .from(cycleTable)
    .where(
      and(eq(cycleTable.id, cycleId), eq(cycleTable.projectId, projectId)),
    );
  if (!cycle) throw new HTTPException(404, { message: "Cycle not found" });
}

async function updateTaskCycle({
  id,
  cycleId,
}: {
  id: string;
  cycleId: string | null;
}) {
  const [current] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, id));
  if (!current) throw new HTTPException(404, { message: "Task not found" });
  await assertCycleInProject(current.projectId, cycleId);
  const [task] = await db
    .update(taskTable)
    .set({ cycleId })
    .where(eq(taskTable.id, id))
    .returning();
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  return task;
}

export default updateTaskCycle;
