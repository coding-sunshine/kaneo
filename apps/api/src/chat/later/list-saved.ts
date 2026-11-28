import { and, desc, eq } from "drizzle-orm";
import {
  chatChannelTable,
  chatMessageTable,
  chatSavedMessageTable,
} from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { selectMessages } from "../controllers/select-messages";
import { withFiles } from "../controllers/with-files";
import { withReactions } from "../controllers/with-reactions";
import { withMentions } from "../mentions/with-mentions";
import { readableChannel } from "../readable-channel";

/**
 * My saved messages in this workspace, newest save first. One in a channel I
 * can no longer read is not listed.
 */
export async function listSaved(workspaceId: string, userId: string) {
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const messages = await selectMessages()
    .innerJoin(
      chatSavedMessageTable,
      eq(chatSavedMessageTable.messageId, chatMessageTable.id),
    )
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .where(
      and(
        eq(chatSavedMessageTable.userId, userId),
        eq(chatSavedMessageTable.workspaceId, workspaceId),
        eq(chatChannelTable.workspaceId, workspaceId),
        readableChannel(userId, workspaceId, guest),
      ),
    )
    .orderBy(desc(chatSavedMessageTable.createdAt));
  return withMentions(
    workspaceId,
    userId,
    await withFiles(await withReactions(messages)),
  );
}
