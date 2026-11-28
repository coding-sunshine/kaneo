import { eq } from "drizzle-orm";
import { workspaceDestination } from "../agent/destination/store";
import { selfHostedUrl } from "../agent/destination/endpoint";
import { embeddingUrl, isSemanticSearchEnabled } from "../assist/embeddings";
import db from "../database";
import { semanticSearchSettingTable } from "../database/schema";

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/** Whether the workspace's admin turned search by meaning on. */
export async function semanticSearchSwitch(workspaceId: string) {
  const [row] = await db
    .select({ enabled: semanticSearchSettingTable.enabled })
    .from(semanticSearchSettingTable)
    .where(eq(semanticSearchSettingTable.workspaceId, workspaceId));
  return row?.enabled ?? false;
}

/**
 * Whether the workspace's text may go to the embedding service. A workspace
 * that keeps its AI text on its own model server sends it nowhere else: only
 * an embedding service on that same server qualifies.
 */
export async function embeddingEgressAllowed(workspaceId: string) {
  const destination = await workspaceDestination(workspaceId);
  if (destination.provider !== "self-hosted") return true;
  const own = originOf(selfHostedUrl());
  return own !== null && own === originOf(embeddingUrl());
}

/** Search by meaning may read and send the workspace's content. */
export async function semanticSearchAllowed(workspaceId: string) {
  return (
    isSemanticSearchEnabled() &&
    (await semanticSearchSwitch(workspaceId)) &&
    (await embeddingEgressAllowed(workspaceId))
  );
}

export async function saveSemanticSearchSwitch(
  workspaceId: string,
  userId: string,
  enabled: boolean,
) {
  const values = { enabled, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(semanticSearchSettingTable)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({
      target: semanticSearchSettingTable.workspaceId,
      set: values,
    });
  return semanticSearchView(workspaceId);
}

/** What the setting shows: the switch, and whether text may leave at all. */
export async function semanticSearchView(workspaceId: string) {
  return {
    enabled: await semanticSearchSwitch(workspaceId),
    egressAllowed: await embeddingEgressAllowed(workspaceId),
  };
}
