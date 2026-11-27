import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../database";
import { agentProposalTable, userTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { resolveCitations } from "../resolve-citations";

type Reader = Parameters<typeof resolveCitations>[0];

const requester = alias(userTable, "requester");
const accepter = alias(userTable, "accepter");

/**
 * The AI writes someone accepted in the workspace, newest first: prompt, tool
 * calls, sources, who accepted and what came back. A write on a team the
 * reader cannot open is left out.
 */
export async function listAudit(reader: Reader) {
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
      ),
    )
    .orderBy(desc(agentProposalTable.decidedAt))
    .limit(100);
  return Promise.all(
    rows.map(async ({ proposal, requestedBy, acceptedBy }) => ({
      id: proposal.id,
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
