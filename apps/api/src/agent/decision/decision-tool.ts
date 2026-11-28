import type { ToolClient } from "@kaneo/mcp/tools";
import { z } from "zod";

/** Files a decision drawn from a chat thread on a topic, once accepted. */
export const DECISION_TOOL = "file_decision_draft";

export const decisionDraftSchema = z.object({
  workspaceId: z.string().min(1),
  topicId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  content: z.string().max(50_000),
});
export type DecisionDraftArgs = z.output<typeof decisionDraftSchema>;

export const DECISION_DESCRIPTION =
  "File a decision taken in a chat thread as a draft on a topic, for its decider to approve.";

const path = encodeURIComponent;

/**
 * Writes the draft and files it on the topic through `client`, as the person
 * who accepted: it waits there for the topic's decider to approve it.
 */
export async function fileDecisionDraft(
  client: ToolClient,
  args: DecisionDraftArgs,
) {
  const doc = await client.json<{ id: string }>("/api/document", {
    method: "POST",
    body: JSON.stringify({
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
    }),
  });
  await client.json(
    `/api/topic/workspace/${path(args.workspaceId)}/${path(args.topicId)}/document/${path(doc.id)}`,
    { method: "PUT" },
  );
  return { documentId: doc.id, topicId: args.topicId };
}
