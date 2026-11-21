import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTaskSnooze({
  id,
  snoozedUntil,
}: {
  id: string;
  snoozedUntil: Date | null;
}) {
  const [task] = await db
    .update(taskTable)
    .set({ snoozedUntil })
    .where(eq(taskTable.id, id))
    .returning();
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  return task;
}

export default updateTaskSnooze;
