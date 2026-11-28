import { eq } from "drizzle-orm";
import db from "../../database";
import { aiFeatureSettingTable } from "../../database/schema";

export type AiFeatures = {
  triage: boolean;
  prSummary: boolean;
  chatAssistant: boolean;
};

const OFF: AiFeatures = {
  triage: false,
  prSummary: false,
  chatAssistant: false,
};

/** The workspace's AI feature switches; a workspace without a row has all off. */
export async function readAiFeatures(workspaceId: string): Promise<AiFeatures> {
  const [row] = await db
    .select({
      triage: aiFeatureSettingTable.triage,
      prSummary: aiFeatureSettingTable.prSummary,
      chatAssistant: aiFeatureSettingTable.chatAssistant,
    })
    .from(aiFeatureSettingTable)
    .where(eq(aiFeatureSettingTable.workspaceId, workspaceId));
  return row ?? OFF;
}

/** Whether an AI feature that is off by default may run in the workspace. */
export const aiFeatureOn = async (
  workspaceId: string,
  feature: keyof AiFeatures,
) => (await readAiFeatures(workspaceId))[feature];

/**
 * Sets the switches given; a switch left out keeps its stored value. One
 * upsert that writes only the given switches, so two admins changing
 * different switches at once both keep their change.
 */
export async function saveAiFeatures(
  workspaceId: string,
  userId: string,
  changes: Partial<AiFeatures>,
): Promise<AiFeatures> {
  const set = { ...changes, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(aiFeatureSettingTable)
    .values({ workspaceId, ...OFF, ...set })
    .onConflictDoUpdate({ target: aiFeatureSettingTable.workspaceId, set });
  return readAiFeatures(workspaceId);
}
