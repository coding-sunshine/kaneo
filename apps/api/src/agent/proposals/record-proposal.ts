import db from "../../database";
import { agentProposalTable } from "../../database/schema";
import type { Cited } from "../sources";
import type { FieldChange } from "./field-diff";

export type RecordedProposal = {
  workspaceId: string;
  /** The one person who may accept or decline it. */
  userId: string;
  /** The team the write lands in (or the project, for a project update). */
  projectId: string;
  taskId: string | null;
  tool: string;
  arguments: Record<string, unknown>;
  diff: (FieldChange & { reason?: string })[];
  reason: string;
  /** What asked for it: a person's words, or the feature that made it. */
  prompt: string;
  sources?: Cited[];
};

/**
 * Stores a proposal a feature made without a chat (triage, a summary, a
 * thread). It shows as a card to `userId`; nothing changes until they accept.
 */
export async function recordProposal(proposal: RecordedProposal) {
  const toolCallId = `${proposal.tool}:${crypto.randomUUID()}`;
  const [row] = await db
    .insert(agentProposalTable)
    .values({
      ...proposal,
      chatId: null,
      toolCallId,
      toolCalls: [
        {
          id: toolCallId,
          name: proposal.tool,
          arguments: JSON.stringify(proposal.arguments),
        },
      ],
      sources: proposal.sources ?? [],
    })
    .returning();
  if (!row) throw new Error("Proposal not recorded");
  return row;
}
