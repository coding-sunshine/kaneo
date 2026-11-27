import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import {
  initiativeTable,
  initiativeWorkProjectTable,
  workProjectTable,
} from "../../database/schema";
import { filterAssignableUsers } from "../../utils/assert-assignable-user";
import { validateAndParseDate } from "../../utils/validate-dates";
import type { createInitiativeBody, updateInitiativeBody } from "../schema";
import { loadInitiativeDetail } from "./load-initiatives";

type Body = Partial<z.infer<typeof createInitiativeBody>> &
  z.infer<typeof updateInitiativeBody>;

async function assertRefs(workspaceId: string, body: Body) {
  if (body.ownerId) {
    const assignable = await filterAssignableUsers([body.ownerId], workspaceId);
    if (!assignable.has(body.ownerId))
      throw new HTTPException(400, {
        message: "The owner must belong to the workspace",
      });
  }
  const projectIds = [...new Set(body.workProjectIds ?? [])];
  if (projectIds.length) {
    const found = await db
      .select({ id: workProjectTable.id })
      .from(workProjectTable)
      .where(
        and(
          inArray(workProjectTable.id, projectIds),
          eq(workProjectTable.workspaceId, workspaceId),
        ),
      );
    if (found.length !== projectIds.length)
      throw new HTTPException(400, {
        message: "Projects must belong to the workspace",
      });
  }
}

export async function saveInitiative(
  body: Body,
  userId: string,
  existingId?: string,
) {
  const [existing] = existingId
    ? await db
        .select({ workspaceId: initiativeTable.workspaceId })
        .from(initiativeTable)
        .where(eq(initiativeTable.id, existingId))
    : [];
  if (existingId && !existing)
    throw new HTTPException(404, { message: "Initiative not found" });
  const workspaceId = existing?.workspaceId ?? body.workspaceId;
  if (!workspaceId)
    throw new HTTPException(400, { message: "Workspace ID is required" });
  await assertRefs(workspaceId, body);

  const values = {
    name: body.name,
    description: body.description,
    ownerId: body.ownerId,
    targetDate:
      body.targetDate == null
        ? body.targetDate
        : validateAndParseDate(body.targetDate, "targetDate"),
  };

  const id = await db.transaction(async (tx) => {
    let id = existingId;
    if (id) {
      if (Object.values(values).some((value) => value !== undefined))
        await tx
          .update(initiativeTable)
          .set(values)
          .where(eq(initiativeTable.id, id));
    } else {
      const [created] = await tx
        .insert(initiativeTable)
        .values({ ...values, name: values.name ?? "", workspaceId })
        .returning({ id: initiativeTable.id });
      id = created?.id ?? "";
    }
    if (body.workProjectIds) {
      await tx
        .delete(initiativeWorkProjectTable)
        .where(eq(initiativeWorkProjectTable.initiativeId, id));
      const projectIds = [...new Set(body.workProjectIds)];
      if (projectIds.length)
        await tx.insert(initiativeWorkProjectTable).values(
          projectIds.map((workProjectId) => ({
            initiativeId: id,
            workProjectId,
          })),
        );
    }
    return id;
  });
  return loadInitiativeDetail(id, userId);
}

export async function deleteInitiative(id: string) {
  const [deleted] = await db
    .delete(initiativeTable)
    .where(eq(initiativeTable.id, id))
    .returning({ id: initiativeTable.id });
  if (!deleted)
    throw new HTTPException(404, { message: "Initiative not found" });
  return deleted;
}
