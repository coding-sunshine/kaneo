import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { documentTemplateTable } from "../../database/schema";

// Every member sees every template: saving one shares the copy.
export function listTemplates(workspaceId: string) {
  return db
    .select()
    .from(documentTemplateTable)
    .where(eq(documentTemplateTable.workspaceId, workspaceId))
    .orderBy(asc(documentTemplateTable.name), asc(documentTemplateTable.id));
}
