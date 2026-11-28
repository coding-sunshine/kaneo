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
import type { PushMessage } from "./push-message";
import { chatPushText } from "./push-text";
import { pushSender } from "./senders";

/**
 * Pushes a mention or a direct message to the phones and browsers of the
 * people it alerts, the same people its Inbox row reaches, on sessions that
 * are still live. A plain channel message pushes nothing. Tokens the
 * provider calls dead are forgotten.
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

  const recipients = await findChatAlertRecipients({
    channelId: event.channelId,
    authorId: event.userId,
    body: row.body,
    isDirect: row.isDirect,
  });
  if (recipients.length === 0) return;
  const devices = await db
    .select({
      id: pushDeviceTable.id,
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
      const result = await send(device.token, message);
      // The push log: never the token or the text.
      console.info(
        `Push ${result} to ${device.platform} device ${device.id} for message ${event.messageId}`,
      );
      if (result === "dead") dead.push(device.id);
    }),
  );
  if (dead.length)
    await db.delete(pushDeviceTable).where(inArray(pushDeviceTable.id, dead));
}
