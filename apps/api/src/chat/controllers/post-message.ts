import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable, chatThreadReplyTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { syncMessageReferences } from "../mentions/sync-message-references";
import { withMentions } from "../mentions/with-mentions";
import { findThreadRoot } from "./find-thread-root";
import { loadChannel } from "./load-channel";
import { deleteDraft } from "./save-draft";
import { selectMessages } from "./select-messages";

export async function postMessage(
  workspaceId: string,
  channelId: string,
  userId: string,
  body: string,
  replyTo?: string,
) {
  await loadChannel(workspaceId, channelId, userId, "post");
  const parentId = replyTo
    ? await findThreadRoot(channelId, replyTo)
    : undefined;
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(chatMessageTable)
      .values({ channelId, userId, body })
      .returning({ id: chatMessageTable.id });
    if (row && parentId)
      await tx
        .insert(chatThreadReplyTable)
        .values({ messageId: row.id, parentId });
    if (row) await syncMessageReferences(tx, workspaceId, row.id, body);
    return row;
  });
  const [message] = await selectMessages().where(
    eq(chatMessageTable.id, created?.id ?? ""),
  );
  if (!message) throw new Error("Message insert returned no row");
  // A reply comes from the thread's own box, not the channel draft.
  if (!parentId) await deleteDraft(channelId, userId);
  // Realtime delivery only says the channel changed; readers refetch.
  await publishEvent("chat.message_created", {
    workspaceId,
    channelId,
    messageId: message.id,
    userId,
    parentId: parentId ?? null,
  });
  const [withCards] = await withMentions(workspaceId, userId, [
    { ...message, reactions: [], files: [] },
  ]);
  return withCards as NonNullable<typeof withCards>;
}
