import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { estimateOptions } from "../../estimate/scales";
import { withLockedTask } from "./with-locked-task";

async function updateTaskEstimate({
  id,
  estimate,
}: {
  id: string;
  estimate: number | null;
}) {
  const { after: updatedTask } = await withLockedTask(
    id,
    async (tx, before) => {
      if (estimate !== null) {
        const [team] = await tx
          .select()
          .from(projectTable)
          .where(eq(projectTable.id, before.projectId));
        if (!team || !estimateOptions(team).some((o) => o.value === estimate)) {
          throw new HTTPException(400, {
            message: "Estimate is not on the team's estimate scale",
          });
        }
      }
      const [updatedTask] = await tx
        .update(taskTable)
        .set({ estimate })
        .where(eq(taskTable.id, id))
        .returning();
      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task estimate",
        });
      }
      return updatedTask;
    },
  );

  await publishEvent("task.updated", {
    projectId: updatedTask.projectId,
    taskId: id,
  });

  return updatedTask;
}

export default updateTaskEstimate;
