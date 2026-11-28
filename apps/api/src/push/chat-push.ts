import { and, eq, gt, inArray, sql } from "drizzle-orm";
import db from "../database";
import {
  chatChannelTable,
  chatMessageFileTable,
  chatMessageTable,
  pushDeviceTable,
  sessionTable,
  userTable,
} from "../database/schema";
import { findChatAlertRecipients } from "../chat/notifications/alert-recipients";
import { findUnreadRecipients } from "../ws/chat-unread-recipients";
import type { PushMessage } from "./push-message";
import { chatPushText } from "./push-text";
import { pushSender } from "./senders";

/**
 * Pushes a new chat message to the phones of the channel members who may
 * read it, except the author, and to the browsers of the people it alerts,
 * on sessions that are still live. Tokens the provider calls dead are
 * forgotten.
 */
export async function sendChatPush(event: {
  workspaceId: string;
  channelId: string;
  messageId: string;
  userId?: string;
}) {
  const [row] = await db
    .select({
      body: chatMessageTable.body,
      authorName: userTable.name,
      channelName: chatChannelTable.name,
      isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
    })
    .from(chatMessageTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(userTable, eq(userTable.id, chatMessageTable.userId))
    .where(
      and(
        eq(chatMessageTable.id, event.messageId),
        eq(chatMessageTable.channelId, event.channelId),
      ),
    );
  if (!row) return;

  // Phones hear every message; browsers only mentions and direct messages.
  const phones = new Set(
    await findUnreadRecipients(event.channelId, event.userId),
  );
  const browsers = new Set(
    await findChatAlertRecipients({
      channelId: event.channelId,
      authorId: event.userId,
      body: row.body,
      isDirect: row.isDirect,
    }),
  );
  const recipients = [...new Set([...phones, ...browsers])];
  if (recipients.length === 0) return;
  const devices = (
    await db
      .select({
        id: pushDeviceTable.id,
        userId: pushDeviceTable.userId,
        platform: pushDeviceTable.platform,
        token: pushDeviceTable.token,
      })
      .from(pushDeviceTable)
      .innerJoin(sessionTable, eq(sessionTable.id, pushDeviceTable.sessionId))
      .where(
        and(
          inArray(pushDeviceTable.userId, recipients),
          gt(sessionTable.expiresAt, new Date()),
        ),
      )
  ).filter((device) =>
    (device.platform === "web" ? browsers : phones).has(device.userId),
  );
  if (devices.length === 0) return;

  const [file] = await db
    .select({ filename: chatMessageFileTable.filename })
    .from(chatMessageFileTable)
    .where(eq(chatMessageFileTable.messageId, event.messageId))
    .limit(1);

  const message: PushMessage = {
    ...chatPushText({ ...row, filename: file?.filename ?? null }),
    threadId: event.channelId,
    data: {
      kind: "chat",
      workspaceId: event.workspaceId,
      chatChannelId: event.channelId,
      messageId: event.messageId,
    },
  };
  const dead: string[] = [];
  await Promise.all(
    devices.map(async (device) => {
      const send = pushSender(device.platform);
      if (!send) return;
      if ((await send(device.token, message)) === "dead") dead.push(device.id);
    }),
  );
  if (dead.length)
    await db.delete(pushDeviceTable).where(inArray(pushDeviceTable.id, dead));
}
