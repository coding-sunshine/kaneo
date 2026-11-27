import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { agentProposalTable } from "../../database/schema";
import { createSelfClient, forwardedAuthHeaders } from "../self-client";
import { buildAgentTools, CHAT_WRITE_TOOLS } from "../tools";

// A proposal is private to the person who asked for it, like their chat.
const own = (userId: string, workspaceId: string, proposalId: string) =>
  and(
    eq(agentProposalTable.id, proposalId),
    eq(agentProposalTable.userId, userId),
    eq(agentProposalTable.workspaceId, workspaceId),
  );

// Moves a pending proposal to `status` once; a second decision is a 409.
async function claim(
  userId: string,
  workspaceId: string,
  proposalId: string,
  status: "accepted" | "declined",
) {
  const [row] = await db
    .update(agentProposalTable)
    .set({ status, decidedBy: userId, decidedAt: new Date() })
    .where(
      and(
        own(userId, workspaceId, proposalId),
        eq(agentProposalTable.status, "pending"),
      ),
    )
    .returning();
  if (row) return row;
  const [exists] = await db
    .select({ id: agentProposalTable.id })
    .from(agentProposalTable)
    .where(own(userId, workspaceId, proposalId));
  throw exists
    ? new HTTPException(409, { message: "This proposal was already decided" })
    : new HTTPException(404, { message: "Proposal not found" });
}

/**
 * Applies the proposed write with the accepting request's own credentials, so
 * the API checks their permissions and the activity names them. A refused or
 * failed write leaves the proposal `failed`, with the error as its result.
 */
export async function acceptProposal(
  userId: string,
  workspaceId: string,
  proposalId: string,
  headers: Headers,
) {
  const row = await claim(userId, workspaceId, proposalId, "accepted");
  const tools = buildAgentTools(
    createSelfClient(forwardedAuthHeaders(headers)),
    CHAT_WRITE_TOOLS,
  );
  const outcome = await tools
    .run(row.tool, row.arguments)
    .catch((error: unknown) => ({
      text: JSON.stringify({
        error: error instanceof Error ? error.message : "The change failed",
      }),
      isError: true,
    }));
  const [done] = await db
    .update(agentProposalTable)
    .set({
      status: outcome.isError ? "failed" : "accepted",
      result: outcome.text,
    })
    .where(eq(agentProposalTable.id, row.id))
    .returning();
  return done ?? row;
}

export const declineProposal = (
  userId: string,
  workspaceId: string,
  proposalId: string,
) => claim(userId, workspaceId, proposalId, "declined");
