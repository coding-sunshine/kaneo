import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import {
  documentCommentTable,
  documentSubscriberTable,
  userTable,
} from "../../database/schema";
import type { createCommentBody, updateCommentBody } from "../schema";
import { loadDocument } from "./load-document";
import { notifyComment } from "./notify";

const commentColumns = {
  id: documentCommentTable.id,
  documentId: documentCommentTable.documentId,
  parentId: documentCommentTable.parentId,
  userId: documentCommentTable.userId,
  userName: userTable.name,
  userImage: userTable.image,
  content: documentCommentTable.content,
  quotedText: documentCommentTable.quotedText,
  resolvedAt: documentCommentTable.resolvedAt,
  resolvedById: documentCommentTable.resolvedById,
  createdAt: documentCommentTable.createdAt,
  updatedAt: documentCommentTable.updatedAt,
};

function selectComments() {
  return db
    .select(commentColumns)
    .from(documentCommentTable)
    .leftJoin(userTable, eq(userTable.id, documentCommentTable.userId));
}

async function commentOrThrow(documentId: string, commentId: string) {
  const [comment] = await db
    .select()
    .from(documentCommentTable)
    .where(
      and(
        eq(documentCommentTable.id, commentId),
        eq(documentCommentTable.documentId, documentId),
      ),
    );
  if (!comment) throw new HTTPException(404, { message: "Comment not found" });
  return comment;
}

async function commentResponse(commentId: string) {
  const [comment] = await selectComments().where(
    eq(documentCommentTable.id, commentId),
  );
  if (!comment) throw new HTTPException(404, { message: "Comment not found" });
  return comment;
}

export async function listComments(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await loadDocument(workspaceId, id, userId);
  return selectComments()
    .where(eq(documentCommentTable.documentId, id))
    .orderBy(asc(documentCommentTable.createdAt));
}

export async function createComment(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof createCommentBody>,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "comment" });
  if (body.parentId) {
    const parent = await commentOrThrow(id, body.parentId);
    // Threads are one level deep, like Linear.
    if (parent.parentId) {
      throw new HTTPException(400, { message: "Reply to the thread instead" });
    }
  }
  const [created] = await db
    .insert(documentCommentTable)
    .values({
      documentId: id,
      userId,
      parentId: body.parentId ?? null,
      content: body.content,
      quotedText: body.parentId ? null : (body.quotedText ?? null),
    })
    .returning({ id: documentCommentTable.id });
  if (!created) throw new Error("Comment insert returned no row");

  await notifyComment(doc, userId, body.content);
  // Commenting subscribes you, as in Linear.
  await db
    .insert(documentSubscriberTable)
    .values({ documentId: id, userId })
    .onConflictDoNothing();
  return commentResponse(created.id);
}

export async function updateComment(
  workspaceId: string,
  id: string,
  userId: string,
  commentId: string,
  body: z.infer<typeof updateCommentBody>,
) {
  await loadDocument(workspaceId, id, userId, { need: "comment" });
  const comment = await commentOrThrow(id, commentId);
  if (body.content !== undefined && comment.userId !== userId) {
    throw new HTTPException(403, {
      message: "You can only edit your own comments",
    });
  }
  if (body.resolved !== undefined && comment.parentId) {
    throw new HTTPException(400, { message: "Resolve the thread instead" });
  }
  await db
    .update(documentCommentTable)
    .set({
      ...(body.content !== undefined && { content: body.content }),
      ...(body.resolved !== undefined && {
        resolvedAt: body.resolved ? new Date() : null,
        resolvedById: body.resolved ? userId : null,
      }),
    })
    .where(eq(documentCommentTable.id, commentId));
  return commentResponse(commentId);
}

// Deleting a thread's first comment removes its replies too.
export async function deleteComment(
  workspaceId: string,
  id: string,
  userId: string,
  commentId: string,
) {
  await loadDocument(workspaceId, id, userId);
  const comment = await commentOrThrow(id, commentId);
  if (comment.userId !== userId) {
    throw new HTTPException(403, {
      message: "You can only delete your own comments",
    });
  }
  await db
    .delete(documentCommentTable)
    .where(eq(documentCommentTable.id, commentId));
  return { id: commentId };
}
