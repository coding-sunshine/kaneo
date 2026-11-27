import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validateWebhookUrl } from "../admin/webhooks/validate-webhook-url";
import { newSigningSecret } from "../admin/webhooks/new-signing-secret";
import db, { schema } from "../database";
import { projectAccessCondition } from "../project-access/project-access-condition";

const table = schema.workspaceWebhookTable;

// The teams among `projectIds` that are still in the workspace, split by
// whether the user can open them. A deleted team's id is in neither.
async function teamsOf(
  workspaceId: string,
  userId: string,
  projectIds: string[],
) {
  const rows =
    projectIds.length === 0
      ? []
      : await db
          .select({
            id: schema.projectTable.id,
            open: projectAccessCondition(userId, schema.projectTable.id),
          })
          .from(schema.projectTable)
          .where(
            and(
              eq(schema.projectTable.workspaceId, workspaceId),
              inArray(schema.projectTable.id, projectIds),
            ),
          );
  const ids = (open: boolean) =>
    new Set(rows.filter((row) => row.open === open).map((row) => row.id));
  return { open: ids(true), hidden: ids(false) };
}

// The stored secret is never part of a response, and a team the caller cannot
// open is only counted.
async function publicWebhook(row: typeof table.$inferSelect, userId: string) {
  const { secret: _secret, createdAt, projectIds, ...rest } = row;
  const { open, hidden } = await teamsOf(row.workspaceId, userId, projectIds);
  return {
    ...rest,
    projectIds: projectIds.filter((id) => open.has(id)),
    hiddenProjectCount: projectIds.filter((id) => hidden.has(id)).length,
    createdAt: createdAt.toISOString(),
  };
}

// A team the caller cannot open answers like one that does not exist.
async function assertTeams(
  workspaceId: string,
  userId: string,
  projectIds: string[],
) {
  const { open } = await teamsOf(workspaceId, userId, projectIds);
  if (open.size !== new Set(projectIds).size)
    throw new HTTPException(400, { message: "Unknown team in the filter" });
}

export async function listWebhooks(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.workspaceId, workspaceId))
    .orderBy(asc(table.createdAt), asc(table.id));
  return Promise.all(rows.map((row) => publicWebhook(row, userId)));
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
  await assertTeams(input.workspaceId, userId, input.projectIds);
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
  return { webhook: await publicWebhook(row, userId), secret };
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
  userId: string,
) {
  const [current] = await db.select().from(table).where(eq(table.id, id));
  if (!current) throw new HTTPException(404, { message: "Webhook not found" });
  const patch = { ...input };
  if (input.url !== undefined) patch.url = await validateWebhookUrl(input.url);
  if (input.projectIds) {
    await assertTeams(current.workspaceId, userId, input.projectIds);
    // The caller sends the teams they can see. The hidden ones stay, and a
    // deleted team's id goes.
    const { hidden } = await teamsOf(
      current.workspaceId,
      userId,
      current.projectIds,
    );
    patch.projectIds = [...new Set([...input.projectIds, ...hidden])];
  }
  if (input.resourceTypes)
    patch.resourceTypes = [...new Set(input.resourceTypes)];
  const [row] = await db
    .update(table)
    .set(patch)
    .where(eq(table.id, id))
    .returning();
  if (!row) throw new HTTPException(404, { message: "Webhook not found" });
  return publicWebhook(row, userId);
}

export async function deleteWebhook(id: string) {
  const [row] = await db.delete(table).where(eq(table.id, id)).returning();
  if (!row) throw new HTTPException(404, { message: "Webhook not found" });
  return { id };
}
