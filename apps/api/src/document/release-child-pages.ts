import { type SQL, sql } from "drizzle-orm";
import type db from "../database";
import { documentTable } from "../database/schema";

type Database = Pick<typeof db, "update">;

/**
 * `document.parent_document_id` has no foreign key, so whatever deletes
 * documents for good clears it on the pages under them first, in the same
 * transaction. `doomed` names the documents that go: `where` reads its
 * columns, as in sql`doomed.task_id = ${id}`. Those pages move to the top.
 */
export function releaseChildPages(database: Database, where: SQL) {
  return database
    .update(documentTable)
    .set({ parentDocumentId: null })
    .where(
      sql`${documentTable.parentDocumentId} IN (
        SELECT doomed.id FROM document AS doomed WHERE ${where}
      )`,
    );
}
