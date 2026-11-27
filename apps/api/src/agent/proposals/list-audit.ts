import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../database";
import {
  agentProposalTable,
  aiDestinationChangeTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { resolveCitations } from "../resolve-citations";

type Reader = Parameters<typeof resolveCitations>[0];

const requester = alias(userTable, "requester");
const accepter = alias(userTable, "accepter");

const AUDIT_LIMIT = 100;

// An admin's change of where the workspace's AI text goes, as an audit row.
async function destinationChanges(workspaceId: string) {
  const rows = await db
    .select({
      change: aiDestinationChangeTable,
      changedBy: { id: userTable.id, name: userTable.name },
    })
    .from(aiDestinationChangeTable)
    .leftJoin(userTable, eq(userTable.id, aiDestinationChangeTable.changedBy))
    .where(eq(aiDestinationChangeTable.workspaceId, workspaceId))
    .orderBy(desc(aiDestinationChangeTable.createdAt))
    .limit(AUDIT_LIMIT);
  return rows.map(({ change, changedBy }) => {
    const by = changedBy?.id ? changedBy : null;
    return {
      id: change.id,
      kind: "setting" as const,
      tool: "set_ai_destination",
      taskId: null,
      status: "accepted" as const,
      prompt: "",
      toolCalls: [],
      diff: change.diff,
      reason: "",
      sources: [],
      requestedBy: by,
      acceptedBy: by,
      result: null,
      createdAt: change.createdAt,
      decidedAt: change.createdAt,
    };
  });
}

/**
 * The AI writes someone accepted in the workspace, and the admins' changes of
 * the AI data destination, newest first: prompt, tool call, sources, who
 * accepted and what came back. A write is left out unless the reader can open
 * its team and, for a move, the team it goes to.
 */
export async function listAudit(reader: Reader) {
  const [writes, settings] = await Promise.all([
    acceptedWrites(reader),
    destinationChanges(reader.workspaceId),
  ]);
  const time = (row: { decidedAt: Date | null }) =>
    row.decidedAt?.getTime() ?? 0;
  return [...writes, ...settings]
    .sort((a, b) => time(b) - time(a))
    .slice(0, AUDIT_LIMIT);
}

async function acceptedWrites(reader: Reader) {
  const rows = await db
    .select({
      proposal: agentProposalTable,
      requestedBy: { id: requester.id, name: requester.name },
      acceptedBy: { id: accepter.id, name: accepter.name },
    })
    .from(agentProposalTable)
    .leftJoin(requester, eq(requester.id, agentProposalTable.userId))
    .leftJoin(accepter, eq(accepter.id, agentProposalTable.decidedBy))
    .where(
      and(
        eq(agentProposalTable.workspaceId, reader.workspaceId),
        inArray(agentProposalTable.status, ["accepted", "failed"]),
        projectAccessCondition(reader.userId, agentProposalTable.projectId),
        // A move also shows the team it goes to.
        projectAccessCondition(
          reader.userId,
          sql`coalesce(${agentProposalTable.arguments}->>'projectId', ${agentProposalTable.projectId})`,
        ),
      ),
    )
    .orderBy(desc(agentProposalTable.decidedAt))
    .limit(AUDIT_LIMIT);
  return Promise.all(
    rows.map(async ({ proposal, requestedBy, acceptedBy }) => ({
      id: proposal.id,
      kind: "write" as const,
      tool: proposal.tool,
      taskId: proposal.taskId,
      status: proposal.status,
      prompt: proposal.prompt,
      toolCalls: proposal.toolCalls,
      diff: proposal.diff,
      reason: proposal.reason,
      sources: await resolveCitations(reader, proposal.sources),
      requestedBy: requestedBy?.id ? requestedBy : null,
      acceptedBy: acceptedBy?.id ? acceptedBy : null,
      result: proposal.result,
      createdAt: proposal.createdAt,
      decidedAt: proposal.decidedAt,
    })),
  );
}
