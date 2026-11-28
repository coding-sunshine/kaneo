import type { ToolClient } from "@kaneo/mcp/tools";
import { z } from "zod";
import { applyChangeTask } from "../proposals/change-task-tool";

/** Applies an AI triage suggestion; only ever proposed, never offered in a chat. */
export const TRIAGE_TOOL = "triage_task";

export const TRIAGE_DESCRIPTION =
  "Set a triage ticket's priority, labels, assignee and project in one step.";

export const triageTaskSchema = z.object({
  taskId: z.string().trim().min(1),
  priority: z
    .enum(["no-priority", "low", "medium", "high", "urgent"])
    .optional(),
  addLabels: z.array(z.string().trim().min(1)).max(20).optional(),
  userId: z.string().trim().min(1).optional(),
  workProjectId: z.string().trim().min(1).optional(),
});
export type TriageArgs = z.output<typeof triageTaskSchema>;

/** The card's field -> the argument that sets it. */
export const TRIAGE_FIELDS = {
  priority: "priority",
  labels: "addLabels",
  assignee: "userId",
  project: "workProjectId",
} as const satisfies Record<string, keyof TriageArgs>;

/** Applies the kept fields through `client`, as the person who accepted. */
export async function applyTriage(client: ToolClient, args: TriageArgs) {
  const id = encodeURIComponent(args.taskId);
  if (args.priority || args.addLabels?.length) {
    await applyChangeTask(client, {
      taskId: args.taskId,
      priority: args.priority,
      addLabels: args.addLabels,
    });
  }
  if (args.userId) {
    await client.json(`/api/task/assignee/${id}`, {
      method: "PUT",
      body: JSON.stringify({ userId: args.userId }),
    });
  }
  if (args.workProjectId) {
    await client.json(`/api/task/work-project/${id}`, {
      method: "PUT",
      body: JSON.stringify({ workProjectId: args.workProjectId }),
    });
  }
  return { taskId: args.taskId };
}
