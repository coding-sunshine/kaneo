import { and, eq } from "drizzle-orm";
import db from "../database";
import { aiCatchUpPreferenceTable } from "../database/schema";

type Owner = { workspaceId: string; userId: string };

export async function getCatchUpPreference({ workspaceId, userId }: Owner) {
  const [row] = await db
    .select({
      includeDirectMessages: aiCatchUpPreferenceTable.includeDirectMessages,
    })
    .from(aiCatchUpPreferenceTable)
    .where(
      and(
        eq(aiCatchUpPreferenceTable.workspaceId, workspaceId),
        eq(aiCatchUpPreferenceTable.userId, userId),
      ),
    );
  return { includeDirectMessages: row?.includeDirectMessages ?? false };
}

export async function setCatchUpPreference(
  owner: Owner,
  includeDirectMessages: boolean,
) {
  await db
    .insert(aiCatchUpPreferenceTable)
    .values({ ...owner, includeDirectMessages })
    .onConflictDoUpdate({
      target: [
        aiCatchUpPreferenceTable.workspaceId,
        aiCatchUpPreferenceTable.userId,
      ],
      set: { includeDirectMessages, updatedAt: new Date() },
    });
  return { includeDirectMessages };
}
