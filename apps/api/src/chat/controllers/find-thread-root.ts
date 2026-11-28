import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatMessageTable, chatThreadReplyTable } from "../../database/schema";

/**
 * The message a reply to `messageId` goes under: the message itself, or the
 * first message of its thread when it is a reply. A message from another
 * channel is missing here.
 */
export async function findThreadRoot(channelId: string, messageId: string) {
  const [found] = await db
    .select({
      id: chatMessageTable.id,
      parentId: chatThreadReplyTable.parentId,
    })
    .from(chatMessageTable)
    .leftJoin(
      chatThreadReplyTable,
      eq(chatThreadReplyTable.messageId, chatMessageTable.id),
    )
    .where(
      and(
        eq(chatMessageTable.id, messageId),
        eq(chatMessageTable.channelId, channelId),
      ),
    );
  if (!found) throw new HTTPException(404, { message: "Message not found" });
  return found.parentId ?? found.id;
}
