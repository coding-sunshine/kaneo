import { and, desc, eq, notExists } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  agentProposalTable,
  codingAgentRunTable,
  columnTable,
} from "../../database/schema";
import updateTaskStatus from "../../task/controllers/update-task-status";
import { codingAgentConfig, warnCodingAgentOff } from "./coding-agent-config";
import { DELEGATE_TOOL } from "./delegate-tool";
import { readableTask } from "./readable-task";
import { newRunToken } from "./run-token";
import { runView } from "./run-view";

const IN_PROGRESS = "in-progress";

// The person's accepted delegation card for the ticket that has no run yet.
async function acceptedCard(
  userId: string,
  workspaceId: string,
  taskId: string,
) {
  const [card] = await db
    .select({ id: agentProposalTable.id })
    .from(agentProposalTable)
    .where(
      and(
        eq(agentProposalTable.workspaceId, workspaceId),
        eq(agentProposalTable.userId, userId),
        eq(agentProposalTable.taskId, taskId),
        eq(agentProposalTable.tool, DELEGATE_TOOL),
        eq(agentProposalTable.status, "accepted"),
        notExists(
          db
            .select({ id: codingAgentRunTable.id })
            .from(codingAgentRunTable)
            .where(eq(codingAgentRunTable.proposalId, agentProposalTable.id)),
        ),
      ),
    )
    .orderBy(desc(agentProposalTable.decidedAt))
    .limit(1);
  if (!card)
    throw new HTTPException(404, {
      message: "No accepted delegation for this ticket",
    });
  return card;
}

/**
 * Sends the ticket to the coding agent once its card was accepted, then moves
 * the ticket to In Progress. The agent gets a callback address and a token of
 * this run only. A refused request leaves the ticket as it was.
 */
export async function startRun(
  userId: string,
  workspaceId: string,
  taskId: string,
) {
  const agent = codingAgentConfig();
  if (!agent) {
    warnCodingAgentOff();
    throw new HTTPException(503, {
      message: "No coding agent is configured on this server",
    });
  }
  const task = await readableTask(userId, workspaceId, taskId);
  const card = await acceptedCard(userId, workspaceId, task.id);
  const { token, tokenHash } = newRunToken();
  const [run] = await db
    .insert(codingAgentRunTable)
    .values({
      workspaceId,
      taskId: task.id,
      proposalId: card.id,
      requestedBy: userId,
      agent: agent.name,
      tokenHash,
    })
    .onConflictDoNothing()
    .returning();
  if (!run)
    throw new HTTPException(409, { message: "The run already started" });

  const api = (process.env.KANEO_API_URL || "http://localhost:1337").replace(
    /\/+$/,
    "",
  );
  let externalId: string | null = null;
  try {
    const response = await fetch(`${agent.url}/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agent.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        runId: run.id,
        task: {
          id: task.id,
          number: task.number,
          title: task.title,
          description: task.description ?? "",
        },
        callbackUrl: `${api}/api/coding-agent/runs/${run.id}/events`,
        callbackToken: token,
        mcpUrl: `${api}/api/mcp`,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(`The coding agent answered HTTP ${response.status}`);
    const body = (await response.json().catch(() => null)) as {
      id?: unknown;
    } | null;
    externalId = typeof body?.id === "string" ? body.id : null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The coding agent failed";
    await db
      .update(codingAgentRunTable)
      .set({ status: "failed", error: message })
      .where(eq(codingAgentRunTable.id, run.id));
    throw new HTTPException(502, { message });
  }

  const [column] = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, task.projectId),
        eq(columnTable.slug, IN_PROGRESS),
      ),
    );
  if (column && task.status !== IN_PROGRESS) {
    await updateTaskStatus({
      id: task.id,
      status: IN_PROGRESS,
      currentUserId: userId,
    });
  }
  const [started] = await db
    .update(codingAgentRunTable)
    .set({ status: "running", externalId })
    .where(eq(codingAgentRunTable.id, run.id))
    .returning();
  return runView(started ?? run);
}
