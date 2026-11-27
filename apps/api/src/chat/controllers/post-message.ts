import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { loadChannel } from "./load-channel";
import { selectMessages } from "./select-messages";

export async function postMessage(
  workspaceId: string,
  channelId: string,
  userId: string,
  body: string,
) {
  await loadChannel(workspaceId, channelId, userId, "post");
  const [created] = await db
    .insert(chatMessageTable)
    .values({ channelId, userId, body })
    .returning({ id: chatMessageTable.id });
  const [message] = await selectMessages().where(
    eq(chatMessageTable.id, created?.id ?? ""),
  );
  if (!message) throw new Error("Message insert returned no row");
  return message;
}
