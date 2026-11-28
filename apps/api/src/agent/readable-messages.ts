import { and, eq, inArray } from "drizzle-orm";
import { readableChannel } from "../chat/readable-channel";
import db from "../database";
import { chatChannelTable, chatMessageTable } from "../database/schema";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";

const EXCERPT = 80;

const excerpt = (body: string) => {
  const line = body.replace(/\s+/g, " ").trim();
  return line.length > EXCERPT ? `${line.slice(0, EXCERPT - 1)}…` : line;
};

/**
 * The chat messages the reader can open now, in channels of the workspace,
 * by id: an excerpt as the title, and the channel to link to.
 */
export async function readableMessages(
  userId: string,
  workspaceId: string,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, Readable>();
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const rows = await db
    .select({
      id: chatMessageTable.id,
      body: chatMessageTable.body,
      channelId: chatChannelTable.id,
    })
    .from(chatMessageTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .where(
      and(
        inArray(chatMessageTable.id, ids),
        eq(chatChannelTable.workspaceId, workspaceId),
        readableChannel(userId, workspaceId, guest),
      ),
    );
  return new Map<string, Readable>(
    rows.map((row) => [
      row.id,
      { title: excerpt(row.body), channelId: row.channelId },
    ]),
  );
}

type Readable = { title: string; channelId: string };
