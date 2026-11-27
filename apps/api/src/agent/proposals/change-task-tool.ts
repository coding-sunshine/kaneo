import type { ToolClient } from "@kaneo/mcp/tools";
import { z } from "zod";
import { readTaskState } from "./task-state";

export const changeTaskSchema = z.object({
  taskId: z.string().trim().min(1),
  priority: z
    .enum(["no-priority", "low", "medium", "high", "urgent"])
    .optional(),
  addLabels: z
    .array(z.string().trim().min(1))
    .max(20)
    .optional()
    .describe("Names of workspace labels to put on the task"),
  removeLabels: z
    .array(z.string().trim().min(1))
    .max(20)
    .optional()
    .describe("Names of labels to take off the task"),
});

export type ChangeTaskArgs = z.output<typeof changeTaskSchema>;

export const CHANGE_TASK_DESCRIPTION =
  "Change a task's priority and labels in one step. Labels are given by name, as list_workspace_labels shows them.";

/** Label names the ticket cannot take: not a label of its workspace or team. */
export function unknownLabels(
  args: ChangeTaskArgs,
  available: { name: string }[],
) {
  const known = new Set(available.map((label) => label.name));
  return (args.addLabels ?? []).filter((name) => !known.has(name));
}

/** Applies the change through `client`, as the person who accepted it. */
export async function applyChangeTask(
  client: ToolClient,
  args: ChangeTaskArgs,
) {
  const { task, state, onTask, available } = await readTaskState(
    client,
    args.taskId,
  );
  const id = encodeURIComponent(task.id);
  const missing = unknownLabels(args, available);
  if (missing.length) throw new Error(`Unknown labels: ${missing.join(", ")}`);
  if (args.priority && args.priority !== state.priority) {
    await client.json(`/api/task/priority/${id}`, {
      method: "PUT",
      body: JSON.stringify({ priority: args.priority }),
    });
  }
  const remove = new Set(args.removeLabels ?? []);
  for (const label of onTask.filter((label) => remove.has(label.name))) {
    await client.json(`/api/label/${encodeURIComponent(label.id)}/task`, {
      method: "DELETE",
    });
  }
  const has = new Set(state.labels);
  for (const name of args.addLabels ?? []) {
    if (has.has(name) || remove.has(name)) continue;
    const template = available.find((label) => label.name === name);
    if (!template) continue;
    await client.json(`/api/label/${encodeURIComponent(template.id)}/task`, {
      method: "PUT",
      body: JSON.stringify({ taskId: task.id }),
    });
  }
  return readTaskState(client, args.taskId).then(({ state: after }) => ({
    taskId: task.id,
    priority: after.priority,
    labels: after.labels,
  }));
}
