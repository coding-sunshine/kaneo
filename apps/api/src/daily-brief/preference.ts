import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { loadChannel } from "../chat/controllers/load-channel";
import db from "../database";
import {
  dailyBriefChannelTable,
  dailyBriefPreferenceTable,
} from "../database/schema";

const own = (workspaceId: string, userId: string) =>
  and(
    eq(dailyBriefChannelTable.workspaceId, workspaceId),
    eq(dailyBriefChannelTable.userId, userId),
  );

export async function getBriefPreference(workspaceId: string, userId: string) {
  const [preference] = await db
    .select({ enabled: dailyBriefPreferenceTable.enabled })
    .from(dailyBriefPreferenceTable)
    .where(
      and(
        eq(dailyBriefPreferenceTable.workspaceId, workspaceId),
        eq(dailyBriefPreferenceTable.userId, userId),
      ),
    );
  const channels = await db
    .select({ id: dailyBriefChannelTable.channelId })
    .from(dailyBriefChannelTable)
    .where(own(workspaceId, userId));
  return {
    enabled: preference?.enabled ?? false,
    channelIds: channels.map((channel) => channel.id),
  };
}

/**
 * Saves the caller's own brief setting. Each chosen channel must be one they
 * can read now; direct messages and channels marked no AI are never part of
 * a brief.
 */
export async function setBriefPreference(
  workspaceId: string,
  userId: string,
  enabled: boolean,
  channelIds: string[],
) {
  const unique = [...new Set(channelIds)];
  for (const channelId of unique) {
    const channel = await loadChannel(workspaceId, channelId, userId, "read");
    if (channel.isDirect)
      throw new HTTPException(400, {
        message: "Direct messages cannot be part of a brief",
      });
    if (channel.aiDisabled)
      throw new HTTPException(400, {
        message: "A channel marked no AI cannot be part of a brief",
      });
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(dailyBriefPreferenceTable)
      .values({ workspaceId, userId, enabled })
      .onConflictDoUpdate({
        target: [
          dailyBriefPreferenceTable.workspaceId,
          dailyBriefPreferenceTable.userId,
        ],
        set: { enabled },
      });
    await tx.delete(dailyBriefChannelTable).where(own(workspaceId, userId));
    if (unique.length)
      await tx
        .insert(dailyBriefChannelTable)
        .values(
          unique.map((channelId) => ({ workspaceId, userId, channelId })),
        );
  });
  return { enabled, channelIds: unique };
}
