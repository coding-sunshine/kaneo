import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { documentTable } from "../../database/schema";

// The topic's current document, whoever may open it. A topic as read by a
// person names it only to someone who can open it; a write must not take the
// unnamed one for none.
export async function currentDocumentId(topicId: string) {
  const [row] = await db
    .select({ id: documentTable.id })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.topicId, topicId),
        eq(documentTable.status, "current"),
        isNull(documentTable.deletedAt),
      ),
    );
  return row?.id ?? null;
}
