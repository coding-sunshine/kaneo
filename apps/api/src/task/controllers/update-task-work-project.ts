import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable, workProjectTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { assertTaskWorkProject } from "../../work-project/assert-task-work-project";

async function workProjectName(workProjectId: string | null) {
  if (!workProjectId) return null;
  const [workProject] = await db
    .select({ name: workProjectTable.name })
    .from(workProjectTable)
    .where(eq(workProjectTable.id, workProjectId));
  return workProject?.name ?? null;
}

async function updateTaskWorkProject({
  id,
  workProjectId,
  workProjectMilestoneId,
  currentUserId,
}: {
  id: string;
  workProjectId: string | null;
  workProjectMilestoneId: string | null;
  currentUserId?: string;
}) {
  const [current] = await db
    .select({
      projectId: taskTable.projectId,
      workProjectId: taskTable.workProjectId,
      title: taskTable.title,
    })
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
  if (current.workProjectId !== workProjectId)
    await publishEvent("task.work_project_changed", {
      taskId: id,
      projectId: current.projectId,
      userId: currentUserId,
      title: current.title,
      fromProject: await workProjectName(current.workProjectId),
      toProject: await workProjectName(workProjectId),
      type: "work_project_changed",
    });
  return task;
}

export default updateTaskWorkProject;
