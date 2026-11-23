import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { cycleTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

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

async function cycleNumber(cycleId: string | null) {
  if (!cycleId) return null;
  const [cycle] = await db
    .select({ number: cycleTable.number })
    .from(cycleTable)
    .where(eq(cycleTable.id, cycleId));
  return cycle?.number ?? null;
}

async function updateTaskCycle({
  id,
  cycleId,
  currentUserId,
}: {
  id: string;
  cycleId: string | null;
  currentUserId?: string;
}) {
  const [current] = await db
    .select({
      projectId: taskTable.projectId,
      cycleId: taskTable.cycleId,
      title: taskTable.title,
    })
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
  if (current.cycleId !== cycleId)
    await publishEvent("task.cycle_changed", {
      taskId: id,
      projectId: current.projectId,
      userId: currentUserId,
      title: current.title,
      fromCycle: await cycleNumber(current.cycleId),
      toCycle: await cycleNumber(cycleId),
      type: "cycle_changed",
    });
  return task;
}

export default updateTaskCycle;
