import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatReminderTable } from "../../database/schema";
import { MAX_REMIND_MS } from "../commands/parse-command";
import { assertReminderRoom } from "../commands/reminder-cap";
import { loadMessage } from "../controllers/load-message";

/**
 * Remind me about a message I can read, at a time the client picked. Only I
 * am told, in my Inbox, and only if I can still read it then.
 */
export async function remindMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  remindAt: Date,
) {
  await loadMessage(workspaceId, channelId, messageId, userId, "read");
  const ahead = remindAt.getTime() - Date.now();
  if (ahead <= 0 || ahead > MAX_REMIND_MS)
    throw new HTTPException(400, {
      message: "Pick a time in the future, up to a year ahead",
    });
  await assertReminderRoom(userId);
  const [reminder] = await db
    .insert(chatReminderTable)
    .values({ userId, workspaceId, channelId, messageId, remindAt })
    .returning();
  if (!reminder) throw new Error("The reminder was not saved");
  return {
    id: reminder.id,
    messageId,
    remindAt: reminder.remindAt.toISOString(),
  };
}
