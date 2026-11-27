import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { aiDestinationChangeTable, userTable } from "../../database/schema";
import { agentHost, openRouterEndpoint } from "../openrouter";
import {
  type AiDestination,
  defaultDestination,
  endpointFor,
  openRouterConfigured,
  selfHostedDefaultModel,
  selfHostedUrl,
} from "./endpoint";

async function latestChange(workspaceId: string) {
  const [row] = await db
    .select({
      provider: aiDestinationChangeTable.provider,
      model: aiDestinationChangeTable.model,
      createdAt: aiDestinationChangeTable.createdAt,
      changedBy: { id: userTable.id, name: userTable.name },
    })
    .from(aiDestinationChangeTable)
    .leftJoin(userTable, eq(userTable.id, aiDestinationChangeTable.changedBy))
    .where(eq(aiDestinationChangeTable.workspaceId, workspaceId))
    .orderBy(desc(aiDestinationChangeTable.createdAt))
    .limit(1);
  return row;
}

export async function workspaceDestination(
  workspaceId: string,
): Promise<AiDestination> {
  const row = await latestChange(workspaceId);
  return row
    ? { provider: row.provider, model: row.model }
    : defaultDestination();
}

/** The endpoint a workspace's model calls go to; 503 when it is not served. */
export const workspaceEndpoint = async (workspaceId: string) =>
  endpointFor(await workspaceDestination(workspaceId));

/** What the settings page shows: who receives the text, and which model. */
export async function destinationView(workspaceId: string, canChange: boolean) {
  const row = await latestChange(workspaceId);
  const destination = row
    ? { provider: row.provider, model: row.model }
    : defaultDestination();
  const openRouterModel = openRouterEndpoint().model;
  const isOpenRouter = destination.provider === "openrouter";
  return {
    provider: destination.provider,
    model: isOpenRouter
      ? openRouterModel
      : destination.model || selfHostedDefaultModel() || null,
    host: isOpenRouter ? agentHost(openRouterModel) || null : null,
    openRouter: { configured: openRouterConfigured() },
    selfHosted: { configured: Boolean(selfHostedUrl()) },
    canChange,
    changedAt: row?.createdAt ?? null,
    changedBy: row?.changedBy?.id ? row.changedBy : null,
  };
}

/**
 * Saves an admin's choice as a new change row, which the AI audit lists. A
 * provider the server cannot serve is refused, so the setting never names a
 * destination that would turn AI off.
 */
export async function changeDestination(
  workspaceId: string,
  userId: string,
  next: AiDestination,
) {
  if (next.provider === "self-hosted" && !selfHostedUrl())
    throw new HTTPException(400, {
      message: "This server has no self-hosted model configured.",
    });
  if (next.provider === "openrouter" && !openRouterConfigured())
    throw new HTTPException(400, {
      message: "This server has no OpenRouter key configured.",
    });
  const model = next.provider === "self-hosted" ? next.model : null;
  const current = await workspaceDestination(workspaceId);
  const diff = [
    { field: "provider", from: current.provider, to: next.provider },
    { field: "model", from: current.model, to: model },
  ].filter((change) => change.from !== change.to);
  if (diff.length > 0) {
    await db.insert(aiDestinationChangeTable).values({
      workspaceId,
      provider: next.provider,
      model,
      changedBy: userId,
      diff,
    });
  }
}
