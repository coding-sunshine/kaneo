import { and, asc, eq, isNotNull, isNull, not, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../database";
import {
  favoriteTable,
  projectTable,
  savedViewTable,
  userTable,
} from "../database/schema";
import { isGuestCondition } from "../guest/guest-condition";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type { createViewBody, updateViewBody } from "./schema";

const selectView = () =>
  db
    .select({
      id: savedViewTable.id,
      workspaceId: savedViewTable.workspaceId,
      projectId: savedViewTable.projectId,
      ownerId: savedViewTable.ownerId,
      ownerName: userTable.name,
      visibility: savedViewTable.visibility,
      name: savedViewTable.name,
      description: savedViewTable.description,
      filters: savedViewTable.filters,
      display: savedViewTable.display,
      createdAt: savedViewTable.createdAt,
      updatedAt: savedViewTable.updatedAt,
    })
    .from(savedViewTable)
    .leftJoin(userTable, eq(userTable.id, savedViewTable.ownerId));

// Personal views exist only for their owner; everything else is shared. A
// view on a team is open to whoever can open that team, its owner included:
// its name and filters describe the team's issues. A guest sees no other
// person's workspace-wide view.
const visibleTo = (userId: string) =>
  and(
    or(
      eq(savedViewTable.visibility, "shared"),
      eq(savedViewTable.ownerId, userId),
    ),
    or(
      and(
        isNull(savedViewTable.projectId),
        or(
          eq(savedViewTable.ownerId, userId),
          not(isGuestCondition(userId, savedViewTable.workspaceId)),
        ),
      ),
      and(
        isNotNull(savedViewTable.projectId),
        projectAccessCondition(userId, savedViewTable.projectId),
      ),
    ),
  );

const withCanEdit = <T extends { ownerId: string | null }>(
  view: T,
  userId: string,
) => ({ ...view, canEdit: view.ownerId === userId });

export async function listViews(workspaceId: string, userId: string) {
  const views = await selectView()
    .where(and(eq(savedViewTable.workspaceId, workspaceId), visibleTo(userId)))
    .orderBy(asc(savedViewTable.name));
  return views.map((view) => withCanEdit(view, userId));
}

export async function getView(workspaceId: string, id: string, userId: string) {
  const [view] = await selectView().where(
    and(
      eq(savedViewTable.id, id),
      eq(savedViewTable.workspaceId, workspaceId),
      visibleTo(userId),
    ),
  );
  if (!view) throw new HTTPException(404, { message: "View not found" });
  return withCanEdit(view, userId);
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
          // A team the person cannot open answers like one that is not there.
          projectAccessCondition(ownerId, projectTable.id),
        ),
      );
    if (!team) throw new HTTPException(400, { message: "Team not found" });
  }
  const [created] = await db
    .insert(savedViewTable)
    .values({ ...body, ownerId })
    .returning({ id: savedViewTable.id });
  return getView(body.workspaceId, created?.id ?? "", ownerId);
}

// Only the owner edits a view, so a teammate's view can't be rewritten.
async function assertOwner(workspaceId: string, id: string, userId: string) {
  const view = await getView(workspaceId, id, userId);
  if (!view.canEdit)
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
  return getView(workspaceId, id, userId);
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
