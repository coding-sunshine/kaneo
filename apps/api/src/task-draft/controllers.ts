import { and, desc, eq, gt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../database";
import { taskDraftTable } from "../database/schema";
import type { draftBody } from "./schema";

type DraftBody = z.infer<typeof draftBody>;

const DRAFT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const mine = (workspaceId: string, id: string, userId: string) =>
  and(
    eq(taskDraftTable.id, id),
    eq(taskDraftTable.workspaceId, workspaceId),
    eq(taskDraftTable.userId, userId),
  );

export async function listDrafts(workspaceId: string, userId: string) {
  // ponytail: expired drafts are hidden here, not deleted; there is no purge job, add one if the table grows.
  return db
    .select()
    .from(taskDraftTable)
    .where(
      and(
        eq(taskDraftTable.workspaceId, workspaceId),
        eq(taskDraftTable.userId, userId),
        gt(taskDraftTable.updatedAt, new Date(Date.now() - DRAFT_TTL_MS)),
      ),
    )
    .orderBy(desc(taskDraftTable.updatedAt));
}

export async function createDraft(
  workspaceId: string,
  userId: string,
  body: DraftBody,
) {
  const [created] = await db
    .insert(taskDraftTable)
    .values({ ...body, workspaceId, userId })
    .returning();
  return created;
}

export async function updateDraft(
  workspaceId: string,
  id: string,
  userId: string,
  body: DraftBody,
) {
  const [updated] = await db
    .update(taskDraftTable)
    .set({ ...body, updatedAt: new Date() })
    .where(mine(workspaceId, id, userId))
    .returning();
  if (!updated) throw new HTTPException(404, { message: "Draft not found" });
  return updated;
}

export async function deleteDraft(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const [deleted] = await db
    .delete(taskDraftTable)
    .where(mine(workspaceId, id, userId))
    .returning({ id: taskDraftTable.id });
  if (!deleted) throw new HTTPException(404, { message: "Draft not found" });
  return deleted;
}
