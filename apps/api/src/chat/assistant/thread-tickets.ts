import { and, eq, inArray } from "drizzle-orm";
import { resolveCitations } from "../../agent/resolve-citations";
import db from "../../database";
import { chatMessageReferenceTable } from "../../database/schema";

type Reader = Parameters<typeof resolveCitations>[0];

/**
 * The keys of the tickets a thread's messages name that the asker can open
 * now. Only keys: the answer is posted to the whole channel, and each reader
 * sees a key's card as their own access allows.
 */
export async function threadTickets(reader: Reader, messageIds: string[]) {
  if (messageIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ id: chatMessageReferenceTable.targetId })
    .from(chatMessageReferenceTable)
    .where(
      and(
        eq(chatMessageReferenceTable.workspaceId, reader.workspaceId),
        eq(chatMessageReferenceTable.targetKind, "task"),
        inArray(chatMessageReferenceTable.messageId, messageIds),
      ),
    );
  const citations = await resolveCitations(
    reader,
    rows.map(({ id }) => ({ kind: "task" as const, id })),
  );
  return citations.flatMap((citation) =>
    !citation.restricted && citation.ticket ? [citation.ticket] : [],
  );
}
