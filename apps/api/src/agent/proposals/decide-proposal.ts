import type { ToolClient } from "@kaneo/mcp/tools";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { agentProposalTable } from "../../database/schema";
import { createSelfClient, forwardedAuthHeaders } from "../self-client";
import { buildAgentTools, CHAT_WRITE_TOOLS } from "../tools";
import {
  type FieldValue,
  missingTicketFields,
} from "../thread-ticket/missing-fields";
import { THREAD_TICKET_TOOL } from "../thread-ticket/thread-ticket-tool";
import { afterAccept } from "./after-accept";
import { keepFields } from "./keep-fields";
import { proposalPlace } from "./proposal-place";

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
  projectId?: string,
  kept?: Pick<typeof agentProposalTable.$inferSelect, "arguments" | "diff">,
) {
  const [row] = await db
    .update(agentProposalTable)
    .set({
      status,
      decidedBy: userId,
      decidedAt: new Date(),
      projectId,
      ...(kept ? { arguments: kept.arguments, diff: kept.diff } : {}),
    })
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
 * the API checks their permissions and the activity names them. A ticket now
 * in a team they cannot open is refused before anything runs. A refused or
 * failed write leaves the proposal `failed`, with the error as its result.
 * `fields` keeps only those fields of a selectable proposal; the record then
 * holds what was applied.
 */
export const acceptProposal = (
  userId: string,
  workspaceId: string,
  proposalId: string,
  headers: Headers,
  fields?: string[],
  customFields?: FieldValue[],
) =>
  acceptProposalAs(
    userId,
    workspaceId,
    proposalId,
    createSelfClient(forwardedAuthHeaders(headers)),
    fields,
    customFields,
  );

/** Accepts as the person `client` acts for: their request, or a run as them. */
export async function acceptProposalAs(
  userId: string,
  workspaceId: string,
  proposalId: string,
  client: ToolClient,
  fields?: string[],
  customFields?: FieldValue[],
) {
  const [pending] = await db
    .select()
    .from(agentProposalTable)
    .where(own(userId, workspaceId, proposalId));
  if (!pending) throw new HTTPException(404, { message: "Proposal not found" });
  // A decided proposal answers 409 from the claim, before any team check.
  const projectId =
    pending.status !== "pending"
      ? undefined
      : await proposalPlace(userId, workspaceId, pending);
  let kept = keepFields(pending, fields);
  if (kept.diff.length === 0)
    throw new HTTPException(400, { message: "Keep at least one field" });
  if (pending.status === "pending" && pending.tool === THREAD_TICKET_TOOL) {
    kept = await withTicketFields(kept, customFields);
  }
  const row = await claim(
    userId,
    workspaceId,
    proposalId,
    "accepted",
    projectId,
    kept === pending ? undefined : kept,
  );
  const tools = buildAgentTools(client, CHAT_WRITE_TOOLS);
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
  if (!outcome.isError) await afterAccept(row, userId, outcome.text);
  return done ?? row;
}

/**
 * A thread ticket with the values the person gave for its team's required
 * fields. One still missing is a 400 before anything runs, so the proposal
 * stays pending and they can fill it in.
 */
async function withTicketFields<
  T extends { arguments: Record<string, unknown> },
>(row: T, customFields: FieldValue[] = []): Promise<T> {
  const projectId = row.arguments.projectId;
  if (typeof projectId !== "string") return row;
  const missing = await missingTicketFields(projectId, customFields);
  if (missing.length)
    throw new HTTPException(400, {
      message: `Fill in ${missing.map((field) => `"${field.name}"`).join(", ")} to create this ticket`,
    });
  if (customFields.length === 0) return row;
  return { ...row, arguments: { ...row.arguments, customFields } };
}

export const declineProposal = (
  userId: string,
  workspaceId: string,
  proposalId: string,
) => claim(userId, workspaceId, proposalId, "declined");
