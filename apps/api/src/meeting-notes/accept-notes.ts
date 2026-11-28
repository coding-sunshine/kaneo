import { HTTPException } from "hono/http-exception";
import { loadDocument } from "../document/controllers/load-document";
import { openProjectIds } from "../skill/open-projects";
import createTask from "../task/controllers/create-task";

/**
 * Creates the action items the caller accepted as tickets in a team they can
 * open. Only what they send is used, so a run they did not keep needs
 * nothing stored.
 */
export async function acceptNotes(
  workspaceId: string,
  documentId: string,
  userId: string,
  projectId: string,
  items: { title: string; description?: string }[],
) {
  await loadDocument(workspaceId, documentId, userId);
  const [open] = await openProjectIds(workspaceId, userId, [projectId]);
  if (!open) throw new HTTPException(404, { message: "Project not found" });
  const tasks = [];
  for (const item of items) {
    const task = await createTask({
      projectId,
      currentUserId: userId,
      title: item.title,
      description: item.description || undefined,
      status: "",
    });
    if (task) tasks.push({ id: task.id, title: task.title, projectId });
  }
  return { tasks };
}
