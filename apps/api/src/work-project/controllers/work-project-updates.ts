import { desc, eq } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import {
  userTable,
  workProjectTable,
  workProjectUpdateTable,
} from "../../database/schema";
import { HTTPException } from "hono/http-exception";
import type { createUpdateBody, updateUpdateBody } from "../schema";

const select = {
  id: workProjectUpdateTable.id,
  workProjectId: workProjectUpdateTable.workProjectId,
  workProjectName: workProjectTable.name,
  userId: workProjectUpdateTable.userId,
  userName: userTable.name,
  userImage: userTable.image,
  health: workProjectUpdateTable.health,
  body: workProjectUpdateTable.body,
  createdAt: workProjectUpdateTable.createdAt,
};

const base = () =>
  db
    .select(select)
    .from(workProjectUpdateTable)
    .innerJoin(
      workProjectTable,
      eq(workProjectTable.id, workProjectUpdateTable.workProjectId),
    )
    .leftJoin(userTable, eq(userTable.id, workProjectUpdateTable.userId));

export const listProjectUpdates = (workProjectId: string) =>
  base()
    .where(eq(workProjectUpdateTable.workProjectId, workProjectId))
    .orderBy(desc(workProjectUpdateTable.createdAt));

// Pulse: newest updates across the workspace.
export const listWorkspaceUpdates = (workspaceId: string) =>
  base()
    .where(eq(workProjectTable.workspaceId, workspaceId))
    .orderBy(desc(workProjectUpdateTable.createdAt))
    .limit(100);

// Project health follows its latest update, or clears when none is left.
async function syncHealth(
  tx: Pick<typeof db, "select" | "update">,
  id: string,
) {
  const [latest] = await tx
    .select({ health: workProjectUpdateTable.health })
    .from(workProjectUpdateTable)
    .where(eq(workProjectUpdateTable.workProjectId, id))
    .orderBy(
      desc(workProjectUpdateTable.createdAt),
      desc(workProjectUpdateTable.id),
    )
    .limit(1);
  await tx
    .update(workProjectTable)
    .set({ health: latest?.health ?? null })
    .where(eq(workProjectTable.id, id));
}

export async function createProjectUpdate(
  workProjectId: string,
  userId: string,
  { health, body }: z.infer<typeof createUpdateBody>,
) {
  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(workProjectUpdateTable)
      .values({ workProjectId, userId, health, body })
      .returning({ id: workProjectUpdateTable.id });
    await syncHealth(tx, workProjectId);
    return created?.id ?? "";
  });
  return loadUpdate(id);
}

async function loadUpdate(id: string) {
  const [row] = await base().where(eq(workProjectUpdateTable.id, id));
  if (!row) throw new HTTPException(404, { message: "Update not found" });
  return row;
}

async function authoredUpdate(id: string, userId: string, isAdmin: boolean) {
  const row = await loadUpdate(id);
  if (row.userId !== userId && !isAdmin)
    throw new HTTPException(403, {
      message: "Only the author or an admin can change this update",
    });
  return row;
}

export async function editProjectUpdate(
  id: string,
  userId: string,
  body: z.infer<typeof updateUpdateBody>,
) {
  // Editing is author-only; admins may delete but not rewrite.
  const row = await authoredUpdate(id, userId, false);
  await db.transaction(async (tx) => {
    await tx
      .update(workProjectUpdateTable)
      .set({ health: body.health, body: body.body })
      .where(eq(workProjectUpdateTable.id, id));
    await syncHealth(tx, row.workProjectId);
  });
  return loadUpdate(id);
}

export async function deleteProjectUpdate(
  id: string,
  userId: string,
  isAdmin: boolean,
) {
  const row = await authoredUpdate(id, userId, isAdmin);
  await db.transaction(async (tx) => {
    await tx
      .delete(workProjectUpdateTable)
      .where(eq(workProjectUpdateTable.id, id));
    await syncHealth(tx, row.workProjectId);
  });
  return { id };
}
