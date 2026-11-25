import { and, eq, max, ne } from "drizzle-orm";
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
  userId: string,
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
  return loadMilestone(created.id, userId);
}

export async function updateMilestone(
  id: string,
  body: z.infer<typeof updateMilestoneBody>,
  userId: string,
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
  if (body.name !== undefined) {
    const [milestone] = await db
      .select({ workProjectId: workProjectMilestoneTable.workProjectId })
      .from(workProjectMilestoneTable)
      .where(eq(workProjectMilestoneTable.id, id));
    const [clash] = milestone
      ? await db
          .select({ id: workProjectMilestoneTable.id })
          .from(workProjectMilestoneTable)
          .where(
            and(
              eq(
                workProjectMilestoneTable.workProjectId,
                milestone.workProjectId,
              ),
              eq(workProjectMilestoneTable.name, body.name),
              ne(workProjectMilestoneTable.id, id),
            ),
          )
      : [];
    if (clash)
      throw new HTTPException(409, {
        message: "A milestone with this name already exists",
      });
  }
  if (Object.values(set).some((value) => value !== undefined))
    await db
      .update(workProjectMilestoneTable)
      .set(set)
      .where(eq(workProjectMilestoneTable.id, id));
  return loadMilestone(id, userId);
}

export async function deleteMilestone(id: string) {
  await db
    .delete(workProjectMilestoneTable)
    .where(and(eq(workProjectMilestoneTable.id, id)));
  return { id };
}
