import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import {
  initiativeTable,
  initiativeUpdateTable,
  userTable,
} from "../../database/schema";
import type { createInitiativeUpdateBody } from "../schema";

const base = () =>
  db
    .select({
      id: initiativeUpdateTable.id,
      initiativeId: initiativeUpdateTable.initiativeId,
      initiativeName: initiativeTable.name,
      userId: initiativeUpdateTable.userId,
      userName: userTable.name,
      userImage: userTable.image,
      health: initiativeUpdateTable.health,
      body: initiativeUpdateTable.body,
      createdAt: initiativeUpdateTable.createdAt,
    })
    .from(initiativeUpdateTable)
    .innerJoin(
      initiativeTable,
      eq(initiativeTable.id, initiativeUpdateTable.initiativeId),
    )
    .leftJoin(userTable, eq(userTable.id, initiativeUpdateTable.userId));

const newestFirst = [
  desc(initiativeUpdateTable.createdAt),
  desc(initiativeUpdateTable.id),
];

export const listInitiativeUpdates = (initiativeId: string) =>
  base()
    .where(eq(initiativeUpdateTable.initiativeId, initiativeId))
    .orderBy(...newestFirst);

// Pulse: newest initiative updates across the workspace.
export const listWorkspaceInitiativeUpdates = (workspaceId: string) =>
  base()
    .where(eq(initiativeTable.workspaceId, workspaceId))
    .orderBy(...newestFirst)
    .limit(100);

async function loadUpdate(id: string) {
  const [row] = await base().where(eq(initiativeUpdateTable.id, id));
  if (!row) throw new HTTPException(404, { message: "Update not found" });
  return row;
}

export async function createInitiativeUpdate(
  initiativeId: string,
  userId: string,
  { health, body }: z.infer<typeof createInitiativeUpdateBody>,
) {
  const [created] = await db
    .insert(initiativeUpdateTable)
    .values({ initiativeId, userId, health, body })
    .returning({ id: initiativeUpdateTable.id });
  return loadUpdate(created?.id ?? "");
}

export async function deleteInitiativeUpdate(
  id: string,
  userId: string,
  isAdmin: boolean,
) {
  const row = await loadUpdate(id);
  if (row.userId !== userId && !isAdmin)
    throw new HTTPException(403, {
      message: "Only the author or an admin can delete this update",
    });
  await db
    .delete(initiativeUpdateTable)
    .where(eq(initiativeUpdateTable.id, id));
  return { id };
}
