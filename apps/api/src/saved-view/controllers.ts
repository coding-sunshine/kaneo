import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../database";
import {
  favoriteTable,
  projectTable,
  savedViewTable,
  userTable,
} from "../database/schema";
import type { createViewBody, updateViewBody } from "./schema";

const selectView = () =>
  db
    .select({
      id: savedViewTable.id,
      workspaceId: savedViewTable.workspaceId,
      projectId: savedViewTable.projectId,
      ownerId: savedViewTable.ownerId,
      ownerName: userTable.name,
      name: savedViewTable.name,
      description: savedViewTable.description,
      filters: savedViewTable.filters,
      display: savedViewTable.display,
      createdAt: savedViewTable.createdAt,
      updatedAt: savedViewTable.updatedAt,
    })
    .from(savedViewTable)
    .leftJoin(userTable, eq(userTable.id, savedViewTable.ownerId));

export const listViews = (workspaceId: string) =>
  selectView()
    .where(eq(savedViewTable.workspaceId, workspaceId))
    .orderBy(asc(savedViewTable.name));

export async function getView(workspaceId: string, id: string) {
  const [view] = await selectView().where(
    and(eq(savedViewTable.id, id), eq(savedViewTable.workspaceId, workspaceId)),
  );
  if (!view) throw new HTTPException(404, { message: "View not found" });
  return view;
}

export async function createView(
  ownerId: string,
  body: z.infer<typeof createViewBody>,
) {
  if (body.projectId) {
    const [team] = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, body.projectId),
          eq(projectTable.workspaceId, body.workspaceId),
        ),
      );
    if (!team) throw new HTTPException(400, { message: "Team not found" });
  }
  const [created] = await db
    .insert(savedViewTable)
    .values({ ...body, ownerId })
    .returning({ id: savedViewTable.id });
  return getView(body.workspaceId, created?.id ?? "");
}

// Only the owner edits a view, so a teammate's view can't be rewritten.
async function assertOwner(workspaceId: string, id: string, userId: string) {
  const view = await getView(workspaceId, id);
  if (view.ownerId !== userId)
    throw new HTTPException(403, {
      message: "Only the owner can change this view",
    });
}

export async function updateView(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof updateViewBody>,
) {
  await assertOwner(workspaceId, id, userId);
  if (Object.keys(body).length)
    await db.update(savedViewTable).set(body).where(eq(savedViewTable.id, id));
  return getView(workspaceId, id);
}

export async function deleteView(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await assertOwner(workspaceId, id, userId);
  await db.delete(savedViewTable).where(eq(savedViewTable.id, id));
  await db
    .delete(favoriteTable)
    .where(and(eq(favoriteTable.type, "view"), eq(favoriteTable.targetId, id)));
  return { id };
}
