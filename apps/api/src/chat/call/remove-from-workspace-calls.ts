import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { readCallConfig } from "./call-config";
import { removeFromCall } from "./remove-from-call";

/** Drops someone who lost a workspace from the calls of its channels. */
export async function removeFromWorkspaceCalls(
  userId: string,
  workspaceId: string,
) {
  if (!readCallConfig()) return;
  const channels = await db
    .select({ id: chatChannelTable.id })
    .from(chatChannelMemberTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatChannelMemberTable.channelId),
    )
    .where(
      and(
        eq(chatChannelMemberTable.userId, userId),
        eq(chatChannelTable.workspaceId, workspaceId),
      ),
    );
  await Promise.all(channels.map(({ id }) => removeFromCall(id, userId)));
}
