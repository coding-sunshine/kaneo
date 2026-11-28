import { eq } from "drizzle-orm";
import db from "../../database";
import { aiTriageSettingTable } from "../../database/schema";

export type TriageSettings = { guidance: string; autoApply: boolean };

/** A team's triage settings; a team without a row has none of its own. */
export async function readTriageSettings(
  projectId: string,
): Promise<TriageSettings> {
  const [row] = await db
    .select({
      guidance: aiTriageSettingTable.guidance,
      autoApply: aiTriageSettingTable.autoApply,
    })
    .from(aiTriageSettingTable)
    .where(eq(aiTriageSettingTable.projectId, projectId));
  return row ?? { guidance: "", autoApply: false };
}

export async function saveTriageSettings(
  projectId: string,
  userId: string,
  settings: TriageSettings,
): Promise<TriageSettings> {
  const values = { ...settings, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(aiTriageSettingTable)
    .values({ projectId, ...values })
    .onConflictDoUpdate({
      target: aiTriageSettingTable.projectId,
      set: values,
    });
  return settings;
}
