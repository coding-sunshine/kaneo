import { and, eq, ne } from "drizzle-orm";
import db from "../../database";
import { chatChannelMemberTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { createCallSession } from "../call/call-session";
import { assertCanStartCall } from "../call/start-call-limit";
import { loadChannel } from "./load-channel";

export async function startCall(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  const channel = await loadChannel(workspaceId, channelId, userId, "post");
  assertCanStartCall(userId);
  const { name, session } = await createCallSession(channelId, userId);
  const recipients = await db
    .select({ userId: chatChannelMemberTable.userId })
    .from(chatChannelMemberTable)
    .where(
      and(
        eq(chatChannelMemberTable.channelId, channelId),
        ne(chatChannelMemberTable.userId, userId),
      ),
    );
  await publishEvent("chat.call_started", {
    workspaceId,
    channelId,
    channelName: channel.name,
    isDirect: channel.isDirect,
    callerId: userId,
    callerName: name,
    recipientIds: recipients.map((row) => row.userId),
  });
  return session;
}
