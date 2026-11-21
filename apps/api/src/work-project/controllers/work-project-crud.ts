import { and, eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import {
  workProjectMilestoneTable,
  workProjectTable,
} from "../../database/schema";
import { validateAndParseDate } from "../../utils/validate-dates";
import type { createMilestoneBody, updateMilestoneBody } from "../schema";
import { loadMilestone } from "./load-work-projects";

export async function deleteWorkProject(id: string) {
  await db.delete(workProjectTable).where(eq(workProjectTable.id, id));
  return { id };
}

export async function createMilestone(
  workProjectId: string,
  body: z.infer<typeof createMilestoneBody>,
) {
  const [last] = await db
    .select({ sortOrder: max(workProjectMilestoneTable.sortOrder) })
    .from(workProjectMilestoneTable)
    .where(eq(workProjectMilestoneTable.workProjectId, workProjectId));
  const [created] = await db
    .insert(workProjectMilestoneTable)
    .values({
      workProjectId,
      name: body.name,
      description: body.description ?? null,
      targetDate: body.targetDate
        ? validateAndParseDate(body.targetDate, "targetDate")
        : null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    })
    .onConflictDoNothing()
    .returning({ id: workProjectMilestoneTable.id });
  if (!created)
    throw new HTTPException(409, {
      message: "A milestone with this name already exists",
    });
  return loadMilestone(created.id);
}

export async function updateMilestone(
  id: string,
  body: z.infer<typeof updateMilestoneBody>,
) {
  const set = {
    name: body.name,
    description: body.description,
    sortOrder: body.sortOrder,
    targetDate:
      body.targetDate == null
        ? body.targetDate
        : validateAndParseDate(body.targetDate, "targetDate"),
  };
  if (Object.values(set).some((value) => value !== undefined))
    await db
      .update(workProjectMilestoneTable)
      .set(set)
      .where(eq(workProjectMilestoneTable.id, id));
  return loadMilestone(id);
}

export async function deleteMilestone(id: string) {
  await db
    .delete(workProjectMilestoneTable)
    .where(and(eq(workProjectMilestoneTable.id, id)));
  return { id };
}
