import { eq } from "drizzle-orm";
import db from "../../database";
import { aiFeatureSettingTable } from "../../database/schema";

export type AiFeatures = { triage: boolean; prSummary: boolean };

const OFF: AiFeatures = { triage: false, prSummary: false };

/** The workspace's AI feature switches; a workspace without a row has all off. */
export async function readAiFeatures(workspaceId: string): Promise<AiFeatures> {
  const [row] = await db
    .select({
      triage: aiFeatureSettingTable.triage,
      prSummary: aiFeatureSettingTable.prSummary,
    })
    .from(aiFeatureSettingTable)
    .where(eq(aiFeatureSettingTable.workspaceId, workspaceId));
  return row ?? OFF;
}

/** Whether a feature that calls the model on its own may run in the workspace. */
export const aiFeatureOn = async (
  workspaceId: string,
  feature: keyof AiFeatures,
) => (await readAiFeatures(workspaceId))[feature];

export async function saveAiFeatures(
  workspaceId: string,
  userId: string,
  features: AiFeatures,
): Promise<AiFeatures> {
  const values = { ...features, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(aiFeatureSettingTable)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({
      target: aiFeatureSettingTable.workspaceId,
      set: values,
    });
  return features;
}
