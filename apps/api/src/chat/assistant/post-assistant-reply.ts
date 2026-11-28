import db from "../../database";
import {
  chatAssistantReplyTable,
  chatMessageTable,
  chatThreadReplyTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { syncMessageReferences } from "../mentions/sync-message-references";

/**
 * Posts the assistant's answer as a reply in the thread it was asked in. The
 * message has no author; its row says whom it answered.
 */
export async function postAssistantReply(reply: {
  workspaceId: string;
  channelId: string;
  rootId: string;
  askedBy: string;
  body: string;
}) {
  const { workspaceId, channelId, rootId, askedBy, body } = reply;
  const messageId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(chatMessageTable)
      .values({ channelId, userId: null, body })
      .returning({ id: chatMessageTable.id });
    if (!row) throw new Error("Message insert returned no row");
    await tx
      .insert(chatThreadReplyTable)
      .values({ messageId: row.id, parentId: rootId });
    await tx
      .insert(chatAssistantReplyTable)
      .values({ messageId: row.id, askedBy });
    await syncMessageReferences(tx, workspaceId, row.id, body);
    return row.id;
  });
  await publishEvent("chat.message_created", {
    workspaceId,
    channelId,
    messageId,
    parentId: rootId,
  });
}
