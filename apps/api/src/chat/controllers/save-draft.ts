import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatDraftTable } from "../../database/schema";
import { loadChannel } from "./load-channel";

/**
 * Keeps what the caller typed into the channel's composer. Saving an empty
 * body deletes the draft. Only where the caller may post.
 */
export async function saveDraft(
  workspaceId: string,
  channelId: string,
  userId: string,
  body: string,
) {
  await loadChannel(workspaceId, channelId, userId, "post");
  const updatedAt = new Date();
  if (!body.trim()) {
    await deleteDraft(channelId, userId);
    return { channelId, body: "", updatedAt };
  }
  await db
    .insert(chatDraftTable)
    .values({ channelId, userId, body, updatedAt })
    .onConflictDoUpdate({
      target: [chatDraftTable.channelId, chatDraftTable.userId],
      set: { body, updatedAt },
    });
  return { channelId, body, updatedAt };
}

export const deleteDraft = (channelId: string, userId: string) =>
  db
    .delete(chatDraftTable)
    .where(
      and(
        eq(chatDraftTable.channelId, channelId),
        eq(chatDraftTable.userId, userId),
      ),
    );
