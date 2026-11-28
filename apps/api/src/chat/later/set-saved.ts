import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatSavedMessageTable } from "../../database/schema";
import { loadMessage } from "../controllers/load-message";

/** Saves or unsaves a message I can read, for me only. */
export async function setSaved(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  saved: boolean,
) {
  await loadMessage(workspaceId, channelId, messageId, userId, "read");
  if (saved)
    await db
      .insert(chatSavedMessageTable)
      .values({ userId, messageId, workspaceId })
      .onConflictDoNothing();
  else
    await db
      .delete(chatSavedMessageTable)
      .where(
        and(
          eq(chatSavedMessageTable.userId, userId),
          eq(chatSavedMessageTable.messageId, messageId),
        ),
      );
  return { messageId, saved };
}
