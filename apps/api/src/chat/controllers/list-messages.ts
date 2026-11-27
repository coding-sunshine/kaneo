import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { loadChannel } from "./load-channel";
import { selectMessages } from "./select-messages";
import { withReactions } from "./with-reactions";

const PAGE_SIZE = 50;
const OLDER_THAN_TARGET = 25;

// The newest page, oldest first; pass `before` to page back through history,
// or `around` for the page that holds one message (a search result).
export async function listMessages(
  workspaceId: string,
  channelId: string,
  userId: string,
  query: { before?: string; around?: string } = {},
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  if (query.around) return listAround(channelId, query.around);
  const { before } = query;
  const rows = await selectMessages()
    .where(
      and(
        eq(chatMessageTable.channelId, channelId),
        before ? lt(chatMessageTable.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(chatMessageTable.createdAt), desc(chatMessageTable.id))
    .limit(PAGE_SIZE);
  return withReactions(rows.reverse());
}

// Compared in SQL, not through a JS Date, which would drop the microseconds
// that order messages posted within one millisecond.
async function listAround(channelId: string, messageId: string) {
  const target = alias(chatMessageTable, "target");
  const targetKey = db
    .select({ createdAt: target.createdAt, id: target.id })
    .from(target)
    .where(and(eq(target.id, messageId), eq(target.channelId, channelId)));
  const [found] = await targetKey;
  if (!found) throw new HTTPException(404, { message: "Message not found" });

  const key = sql`(${chatMessageTable.createdAt}, ${chatMessageTable.id})`;
  const inChannel = eq(chatMessageTable.channelId, channelId);
  const older = await selectMessages()
    .where(and(inChannel, sql`${key} < (${targetKey})`))
    .orderBy(desc(chatMessageTable.createdAt), desc(chatMessageTable.id))
    .limit(OLDER_THAN_TARGET);
  const rest = await selectMessages()
    .where(and(inChannel, sql`${key} >= (${targetKey})`))
    .orderBy(asc(chatMessageTable.createdAt), asc(chatMessageTable.id))
    .limit(PAGE_SIZE - OLDER_THAN_TARGET);
  return withReactions([...older.reverse(), ...rest]);
}
