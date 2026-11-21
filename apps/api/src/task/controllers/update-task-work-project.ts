import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { assertTaskWorkProject } from "../../work-project/assert-task-work-project";

async function updateTaskWorkProject({
  id,
  workProjectId,
  workProjectMilestoneId,
}: {
  id: string;
  workProjectId: string | null;
  workProjectMilestoneId: string | null;
}) {
  const [current] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, id));
  if (!current) throw new HTTPException(404, { message: "Task not found" });
  await assertTaskWorkProject(
    current.projectId,
    workProjectId,
    workProjectMilestoneId,
  );
  const [task] = await db
    .update(taskTable)
    .set({ workProjectId, workProjectMilestoneId })
    .where(eq(taskTable.id, id))
    .returning();
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  return task;
}

export default updateTaskWorkProject;
