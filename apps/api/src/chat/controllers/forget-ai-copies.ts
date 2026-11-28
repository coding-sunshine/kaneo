import { and, eq, inArray, sql } from "drizzle-orm";
import db from "../../database";
import {
  chatMessageTable,
  dailyBriefTable,
  semanticChunkTable,
} from "../../database/schema";

/**
 * Drops what AI features stored from a channel once its AI is turned off:
 * the embeddings of its messages and its lines in saved daily briefs.
 */
export async function forgetAiCopies(workspaceId: string, channelId: string) {
  await db
    .delete(semanticChunkTable)
    .where(
      inArray(
        semanticChunkTable.messageId,
        db
          .select({ id: chatMessageTable.id })
          .from(chatMessageTable)
          .where(eq(chatMessageTable.channelId, channelId)),
      ),
    );
  const fromChannel = JSON.stringify([{ channelId }]);
  await db
    .update(dailyBriefTable)
    .set({
      content: sql`jsonb_set(${dailyBriefTable.content}, '{mentions}', (
        select coalesce(jsonb_agg(m), '[]'::jsonb)
        from jsonb_array_elements(${dailyBriefTable.content}->'mentions') m
        where m->>'channelId' <> ${channelId}
      ))`,
    })
    .where(
      and(
        eq(dailyBriefTable.workspaceId, workspaceId),
        sql`${dailyBriefTable.content}->'mentions' @> ${fromChannel}::jsonb`,
      ),
    );
}
