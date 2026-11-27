import type { ToolClient } from "@kaneo/mcp/tools";
import type { TaskState } from "./field-diff";

type Label = {
  id: string;
  name: string;
  taskId: string | null;
  projectId?: string | null;
};
type Task = Omit<TaskState, "labels"> & { id: string; workspaceId: string };

const path = (id: string) => encodeURIComponent(id);

/**
 * The ticket, its labels and the labels it may take, read through `client`
 * so only what that person can open comes back.
 */
export async function readTaskState(client: ToolClient, taskId: string) {
  const task = await client.json<Task>(`/api/task/${path(taskId)}`);
  const [onTask, inWorkspace] = await Promise.all([
    client.json<Label[]>(`/api/label/task/${path(taskId)}`),
    client.json<Label[]>(`/api/label/workspace/${path(task.workspaceId)}`),
  ]);
  const available = inWorkspace.filter(
    (label) =>
      label.taskId === null &&
      (!label.projectId || label.projectId === task.projectId),
  );
  const state: TaskState = {
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    startDate: task.startDate ?? null,
    userId: task.userId ?? null,
    projectId: task.projectId,
    labels: onTask.map((label) => label.name),
  };
  return { task, state, onTask, available };
}
