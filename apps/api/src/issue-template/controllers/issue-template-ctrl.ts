import { asc, eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { issueTemplateTable } from "../../database/schema";
import { assertTemplateRefs } from "../assert-template-refs";

type TemplateInput = Partial<
  Omit<typeof issueTemplateTable.$inferInsert, "id" | "projectId" | "position">
>;

export function listIssueTemplates(projectId: string) {
  return db
    .select()
    .from(issueTemplateTable)
    .where(eq(issueTemplateTable.projectId, projectId))
    .orderBy(
      asc(issueTemplateTable.position),
      asc(issueTemplateTable.createdAt),
    );
}

export async function createIssueTemplate(
  workspaceId: string,
  projectId: string,
  input: TemplateInput & { name: string },
) {
  await assertTemplateRefs(workspaceId, projectId, input);
  const [last] = await db
    .select({ maxPosition: max(issueTemplateTable.position) })
    .from(issueTemplateTable)
    .where(eq(issueTemplateTable.projectId, projectId));
  const [created] = await db
    .insert(issueTemplateTable)
    .values({ ...input, projectId, position: (last?.maxPosition ?? -1) + 1 })
    .returning();
  return created;
}

export async function updateIssueTemplate(
  workspaceId: string,
  id: string,
  input: TemplateInput,
) {
  const [existing] = await db
    .select({ projectId: issueTemplateTable.projectId })
    .from(issueTemplateTable)
    .where(eq(issueTemplateTable.id, id))
    .limit(1);
  if (!existing) {
    throw new HTTPException(404, { message: "Template not found" });
  }
  await assertTemplateRefs(workspaceId, existing.projectId, input);
  const [updated] = await db
    .update(issueTemplateTable)
    .set(input)
    .where(eq(issueTemplateTable.id, id))
    .returning();
  return updated;
}

export async function deleteIssueTemplate(id: string) {
  const [deleted] = await db
    .delete(issueTemplateTable)
    .where(eq(issueTemplateTable.id, id))
    .returning();
  if (!deleted) {
    throw new HTTPException(404, { message: "Template not found" });
  }
  return deleted;
}
