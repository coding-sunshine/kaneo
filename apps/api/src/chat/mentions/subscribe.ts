import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  chatMessageReferenceTable,
  chatMessageTable,
} from "../../database/schema";
import { publishEvent, subscribeToEvent } from "../../events";

/**
 * A ticket's title or status changed: every channel with a message naming it
 * refetches, so its card shows the change. The event carries no title.
 */
export async function refreshMentioningChannels({
  taskId,
}: {
  taskId?: string;
}) {
  if (!taskId) return;
  const channels = await db
    .selectDistinct({ channelId: chatMessageTable.channelId })
    .from(chatMessageReferenceTable)
    .innerJoin(
      chatMessageTable,
      eq(chatMessageTable.id, chatMessageReferenceTable.messageId),
    )
    .where(
      and(
        eq(chatMessageReferenceTable.targetKind, "task"),
        eq(chatMessageReferenceTable.targetId, taskId),
      ),
    );
  for (const { channelId } of channels)
    await publishEvent("chat.message_updated", { channelId });
}

for (const event of [
  "task.title_changed",
  "task.status_changed",
  "task.updated",
])
  subscribeToEvent<{ taskId?: string }>(event, refreshMentioningChannels);
