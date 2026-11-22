import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validateWebhookUrl } from "../admin/webhooks/validate-webhook-url";
import { newSigningSecret } from "../admin/webhooks/new-signing-secret";
import db, { schema } from "../database";

const table = schema.workspaceWebhookTable;

// The stored secret is never part of a response.
export function publicWebhook(row: typeof table.$inferSelect) {
  const { secret: _secret, createdAt, ...rest } = row;
  return { ...rest, createdAt: createdAt.toISOString() };
}

async function assertTeams(workspaceId: string, projectIds: string[]) {
  if (projectIds.length === 0) return;
  const found = await db
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, workspaceId),
        inArray(schema.projectTable.id, projectIds),
      ),
    );
  if (found.length !== new Set(projectIds).size)
    throw new HTTPException(400, { message: "Unknown team in the filter" });
}

export async function listWebhooks(workspaceId: string) {
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.workspaceId, workspaceId))
    .orderBy(asc(table.createdAt), asc(table.id));
  return rows.map(publicWebhook);
}

export async function createWebhook(
  input: {
    workspaceId: string;
    label: string;
    url: string;
    enabled: boolean;
    resourceTypes: string[];
    projectIds: string[];
  },
  userId: string,
) {
  const url = await validateWebhookUrl(input.url);
  await assertTeams(input.workspaceId, input.projectIds);
  const { secret, encrypted } = newSigningSecret();
  const [row] = await db
    .insert(table)
    .values({
      ...input,
      url,
      resourceTypes: [...new Set(input.resourceTypes)],
      projectIds: [...new Set(input.projectIds)],
      secret: encrypted,
      createdBy: userId,
    })
    .returning();
  if (!row) throw new Error("Webhook insert failed");
  return { webhook: publicWebhook(row), secret };
}

export async function updateWebhook(
  id: string,
  input: Partial<{
    label: string;
    url: string;
    enabled: boolean;
    resourceTypes: string[];
    projectIds: string[];
  }>,
) {
  const [current] = await db.select().from(table).where(eq(table.id, id));
  if (!current) throw new HTTPException(404, { message: "Webhook not found" });
  const patch = { ...input };
  if (input.url !== undefined) patch.url = await validateWebhookUrl(input.url);
  if (input.projectIds) {
    await assertTeams(current.workspaceId, input.projectIds);
    patch.projectIds = [...new Set(input.projectIds)];
  }
  if (input.resourceTypes)
    patch.resourceTypes = [...new Set(input.resourceTypes)];
  const [row] = await db
    .update(table)
    .set(patch)
    .where(eq(table.id, id))
    .returning();
  if (!row) throw new HTTPException(404, { message: "Webhook not found" });
  return publicWebhook(row);
}

export async function deleteWebhook(id: string) {
  const [row] = await db.delete(table).where(eq(table.id, id)).returning();
  if (!row) throw new HTTPException(404, { message: "Webhook not found" });
  return { id };
}
