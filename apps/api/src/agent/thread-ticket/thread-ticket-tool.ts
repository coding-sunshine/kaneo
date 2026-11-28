import type { ToolClient } from "@kaneo/mcp/tools";
import { z } from "zod";
import { applyChangeTask } from "../proposals/change-task-tool";

/** Creates the ticket a chat thread asked for, once a person accepts it. */
export const THREAD_TICKET_TOOL = "create_ticket_from_thread";

export const threadTicketSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  /** The thread's first message; the link back is posted under it. */
  messageId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000),
  userId: z.string().min(1).optional(),
  addLabels: z.array(z.string()).max(10).optional(),
  workProjectId: z.string().min(1).optional(),
});
export type ThreadTicketArgs = z.output<typeof threadTicketSchema>;

export const THREAD_TICKET_DESCRIPTION =
  "Create a ticket from a chat thread and link it from the thread.";

const path = encodeURIComponent;

/**
 * Creates the ticket, labels it and replies in the thread with its key, all
 * through `client` as the person who accepted: the reply shows the ticket's
 * card, and the ticket lists the thread under Mentioned in.
 */
export async function applyThreadTicket(
  client: ToolClient,
  args: ThreadTicketArgs,
) {
  const [column] = await client.json<{ slug: string }[]>(
    `/api/column/${path(args.projectId)}`,
  );
  const task = await client.json<{ id: string; number: number | null }>(
    `/api/task/${path(args.projectId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        title: args.title,
        description: args.description,
        priority: "no-priority",
        status: column?.slug ?? "to-do",
        userId: args.userId,
        workProjectId: args.workProjectId,
        sourceMessage: { channelId: args.channelId, messageId: args.messageId },
      }),
    },
  );
  if (args.addLabels?.length) {
    await applyChangeTask(client, {
      taskId: task.id,
      addLabels: args.addLabels,
    });
  }
  const team = await client.json<{ slug: string }>(
    `/api/project/${path(args.projectId)}`,
  );
  await client.json(
    `/api/chat/workspace/${path(args.workspaceId)}/channels/${path(args.channelId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        body: `${team.slug.toUpperCase()}-${task.number} ${args.title}`,
        parentId: args.messageId,
      }),
    },
  );
  return { taskId: task.id };
}
