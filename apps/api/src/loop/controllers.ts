import { and, asc, desc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../database";
import { loopRunTable, loopTable, userTable } from "../database/schema";
import { nextRunAfter } from "./schedule";
import type { createLoopBody, updateLoopBody } from "./schema";

const selectLoop = () =>
  db
    .select({
      id: loopTable.id,
      workspaceId: loopTable.workspaceId,
      creatorId: loopTable.creatorId,
      creatorName: userTable.name,
      name: loopTable.name,
      instructions: loopTable.instructions,
      frequency: loopTable.frequency,
      enabled: loopTable.enabled,
      nextRunAt: loopTable.nextRunAt,
      lastRunAt: sql<Date | null>`(
        select max(${loopRunTable.startedAt}) from ${loopRunTable}
        where ${loopRunTable.loopId} = ${loopTable.id}
      )`.mapWith((value) => (value ? new Date(`${value}Z`) : null)),
      createdAt: loopTable.createdAt,
    })
    .from(loopTable)
    .leftJoin(userTable, eq(userTable.id, loopTable.creatorId));

export const listLoops = (
  workspaceId: string,
  userId: string,
  scope: "mine" | "all",
) =>
  selectLoop()
    .where(
      scope === "mine"
        ? and(
            eq(loopTable.workspaceId, workspaceId),
            eq(loopTable.creatorId, userId),
          )
        : eq(loopTable.workspaceId, workspaceId),
    )
    .orderBy(asc(loopTable.name));

export async function getLoop(workspaceId: string, id: string) {
  const [loop] = await selectLoop().where(
    and(eq(loopTable.id, id), eq(loopTable.workspaceId, workspaceId)),
  );
  if (!loop) throw new HTTPException(404, { message: "Loop not found" });
  return loop;
}

// A loop acts with its creator's permissions, so only the creator may change,
// run or delete it. Anyone else could otherwise borrow those permissions.
export async function getOwnLoop(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const loop = await getLoop(workspaceId, id);
  if (loop.creatorId !== userId)
    throw new HTTPException(403, {
      message: "Only the creator can change this loop",
    });
  return loop;
}

export async function createLoop(
  creatorId: string,
  body: z.infer<typeof createLoopBody>,
) {
  const [created] = await db
    .insert(loopTable)
    .values({
      ...body,
      creatorId,
      nextRunAt: nextRunAfter(body.frequency, new Date()),
    })
    .returning({ id: loopTable.id });
  return getLoop(body.workspaceId, created?.id ?? "");
}

export async function updateLoop(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof updateLoopBody>,
) {
  const loop = await getOwnLoop(workspaceId, id, userId);
  const reschedule =
    (body.frequency !== undefined && body.frequency !== loop.frequency) ||
    (body.enabled === true && !loop.enabled);
  if (Object.keys(body).length)
    await db
      .update(loopTable)
      .set({
        ...body,
        ...(reschedule && {
          nextRunAt: nextRunAfter(body.frequency ?? loop.frequency, new Date()),
        }),
      })
      .where(eq(loopTable.id, id));
  return getLoop(workspaceId, id);
}

export async function deleteLoop(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await getOwnLoop(workspaceId, id, userId);
  await db.delete(loopTable).where(eq(loopTable.id, id));
  return { id };
}

export async function listRuns(workspaceId: string, id: string) {
  await getLoop(workspaceId, id);
  return db
    .select({
      id: loopRunTable.id,
      trigger: loopRunTable.trigger,
      status: loopRunTable.status,
      error: loopRunTable.error,
      startedAt: loopRunTable.startedAt,
      finishedAt: loopRunTable.finishedAt,
    })
    .from(loopRunTable)
    .where(eq(loopRunTable.loopId, id))
    .orderBy(desc(loopRunTable.startedAt))
    .limit(50);
}

export async function getRun(workspaceId: string, id: string, runId: string) {
  await getLoop(workspaceId, id);
  const [run] = await db
    .select()
    .from(loopRunTable)
    .where(and(eq(loopRunTable.id, runId), eq(loopRunTable.loopId, id)));
  if (!run) throw new HTTPException(404, { message: "Run not found" });
  return run;
}
