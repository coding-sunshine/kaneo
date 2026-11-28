import { and, asc, desc, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { agentProposalTable } from "../../database/schema";
import { resolveCitations } from "../resolve-citations";
import { isSelectable } from "./keep-fields";
import { POST_DIGEST_TOOL } from "../digest/digest-tool";
import { PROJECT_UPDATE_TOOL } from "./project-update-tool";

type Row = typeof agentProposalTable.$inferSelect;
type Reader = Parameters<typeof resolveCitations>[0];

/** What the card shows: the diff, the reason, and sources checked for the reader. */
export async function proposalView(reader: Reader, row: Row) {
  return {
    id: row.id,
    toolCallId: row.toolCallId,
    tool: row.tool,
    taskId: row.taskId,
    status: row.status,
    diff: row.diff,
    reason: row.reason,
    selectable: isSelectable(row.tool),
    sources: await resolveCitations(reader, row.sources),
    decidedAt: row.decidedAt,
    result: row.status === "failed" ? row.result : null,
  };
}

/** The proposals of one of the reader's own chats, in the order they came. */
export async function chatProposals(reader: Reader, chatId: string) {
  const rows = await db
    .select()
    .from(agentProposalTable)
    .where(
      and(
        eq(agentProposalTable.chatId, chatId),
        eq(agentProposalTable.userId, reader.userId),
      ),
    )
    .orderBy(asc(agentProposalTable.createdAt));
  return Promise.all(rows.map((row) => proposalView(reader, row)));
}

/** The reader's project updates that loops drafted and nobody decided yet. */
export async function pendingDrafts(reader: Reader) {
  const rows = await db
    .select()
    .from(agentProposalTable)
    .where(
      and(
        eq(agentProposalTable.workspaceId, reader.workspaceId),
        eq(agentProposalTable.userId, reader.userId),
        inArray(agentProposalTable.tool, [
          PROJECT_UPDATE_TOOL,
          POST_DIGEST_TOOL,
        ]),
        eq(agentProposalTable.status, "pending"),
      ),
    )
    .orderBy(desc(agentProposalTable.createdAt))
    .limit(50);
  return Promise.all(rows.map((row) => proposalView(reader, row)));
}

/** The reader's own proposals about one ticket, newest first. */
export async function taskProposals(reader: Reader, taskId: string) {
  const rows = await db
    .select()
    .from(agentProposalTable)
    .where(
      and(
        eq(agentProposalTable.workspaceId, reader.workspaceId),
        eq(agentProposalTable.userId, reader.userId),
        eq(agentProposalTable.taskId, taskId),
      ),
    )
    .orderBy(desc(agentProposalTable.createdAt))
    .limit(20);
  return Promise.all(rows.map((row) => proposalView(reader, row)));
}
