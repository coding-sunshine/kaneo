import { desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import {
  userTable,
  workProjectTable,
  workProjectUpdateTable,
} from "../../database/schema";
import type { createUpdateBody } from "../schema";

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
    await tx
      .update(workProjectTable)
      .set({ health })
      .where(eq(workProjectTable.id, workProjectId));
    return created?.id ?? "";
  });
  const [row] = await base().where(inArray(workProjectUpdateTable.id, [id]));
  return row;
}
