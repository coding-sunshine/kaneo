import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  documentTemplateTable,
  workspaceUserTable,
} from "../../database/schema";
import { isOwnerRole } from "../../project-access/is-owner-role";

// The person who saved a template, or a workspace owner, may delete it.
export async function deleteTemplate(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const [row] = await db
    .select({
      template: documentTemplateTable,
      role: workspaceUserTable.role,
    })
    .from(documentTemplateTable)
    .leftJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, documentTemplateTable.workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .where(
      and(
        eq(documentTemplateTable.id, id),
        eq(documentTemplateTable.workspaceId, workspaceId),
      ),
    );
  if (!row) {
    throw new HTTPException(404, { message: "Template not found" });
  }
  if (row.template.creatorId !== userId && !isOwnerRole(row.role)) {
    throw new HTTPException(403, {
      message: "Only its creator or a workspace owner can delete a template",
    });
  }
  await db
    .delete(documentTemplateTable)
    .where(eq(documentTemplateTable.id, id));
  return row.template;
}
