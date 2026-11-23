import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable, workProjectCommentTable } from "../../database/schema";

const select = {
  id: workProjectCommentTable.id,
  workProjectId: workProjectCommentTable.workProjectId,
  userId: workProjectCommentTable.userId,
  userName: userTable.name,
  userImage: userTable.image,
  content: workProjectCommentTable.content,
  createdAt: workProjectCommentTable.createdAt,
  updatedAt: workProjectCommentTable.updatedAt,
};

const base = () =>
  db
    .select(select)
    .from(workProjectCommentTable)
    .leftJoin(userTable, eq(userTable.id, workProjectCommentTable.userId));

export const listProjectComments = (workProjectId: string) =>
  base()
    .where(eq(workProjectCommentTable.workProjectId, workProjectId))
    .orderBy(asc(workProjectCommentTable.createdAt));

async function loadComment(id: string) {
  const [row] = await base().where(eq(workProjectCommentTable.id, id));
  if (!row) throw new HTTPException(404, { message: "Comment not found" });
  return row;
}

export async function createProjectComment(
  workProjectId: string,
  userId: string,
  content: string,
) {
  const [created] = await db
    .insert(workProjectCommentTable)
    .values({ workProjectId, userId, content })
    .returning({ id: workProjectCommentTable.id });
  return loadComment(created?.id ?? "");
}

// Editing is author-only; admins may delete but not rewrite (same as updates).
async function authoredComment(id: string, userId: string, isAdmin: boolean) {
  const row = await loadComment(id);
  if (row.userId !== userId && !isAdmin)
    throw new HTTPException(403, {
      message: "Only the author or an admin can change this comment",
    });
  return row;
}

export async function editProjectComment(
  id: string,
  userId: string,
  content: string,
) {
  await authoredComment(id, userId, false);
  await db
    .update(workProjectCommentTable)
    .set({ content, updatedAt: new Date() })
    .where(eq(workProjectCommentTable.id, id));
  return loadComment(id);
}

export async function deleteProjectComment(
  id: string,
  userId: string,
  isAdmin: boolean,
) {
  await authoredComment(id, userId, isAdmin);
  await db
    .delete(workProjectCommentTable)
    .where(eq(workProjectCommentTable.id, id));
  return { id };
}
