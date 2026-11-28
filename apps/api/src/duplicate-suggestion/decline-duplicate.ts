import { HTTPException } from "hono/http-exception";
import db from "../database";
import { taskDuplicateDismissalTable } from "../database/schema";
import { openTask } from "./open-task";

/** Hides the suggestion of this pair, either way round, for good. */
export async function declineDuplicate(
  taskId: string,
  otherTaskId: string,
  workspaceId: string,
  userId: string,
) {
  if (taskId === otherTaskId)
    throw new HTTPException(400, {
      message: "A ticket is not a duplicate of itself",
    });
  await openTask(taskId, workspaceId, userId);
  await openTask(otherTaskId, workspaceId, userId);
  const [lowTaskId, highTaskId] =
    taskId < otherTaskId ? [taskId, otherTaskId] : [otherTaskId, taskId];
  await db
    .insert(taskDuplicateDismissalTable)
    .values({ lowTaskId, highTaskId, dismissedBy: userId })
    .onConflictDoNothing();
  return { declined: true as const };
}
