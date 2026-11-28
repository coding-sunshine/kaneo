import type { ToolClient } from "@kaneo/mcp/tools";
import { z } from "zod";

/** Starts the coding agent on a ticket; only ever proposed, never offered. */
export const DELEGATE_TOOL = "delegate_task";

export const DELEGATE_DESCRIPTION =
  "Hand a ticket to the server's coding agent and move it to In Progress.";

export const delegateTaskSchema = z.object({
  workspaceId: z.string().trim().min(1),
  taskId: z.string().trim().min(1),
});

/** Starts the run through `client`, as the person who accepted the card. */
export const startDelegation = (
  client: ToolClient,
  args: z.output<typeof delegateTaskSchema>,
) =>
  client.json(
    `/api/agent/workspace/${encodeURIComponent(args.workspaceId)}/delegations`,
    { method: "POST", body: JSON.stringify({ taskId: args.taskId }) },
  );
