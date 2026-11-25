import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import { topicSlotTable } from "../../database/schema";
import type { createSlotBody } from "../schema";
import { assertTopicOwner } from "./assert-topic-owner";
import { getTopic } from "./get-topic";

export type Slot = typeof topicSlotTable.$inferSelect;

const KEY = /^[a-z][a-z0-9_]{0,39}$/;

const shown = ({ id, key, name, type, options }: Slot) => ({
  id,
  key,
  name,
  type,
  options,
});

const keyFrom = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

/**
 * The slots of each of the topics, by key, or of every topic when none is
 * named. The caller has checked who may see them.
 */
export async function slotsOf(topicIds?: string[]) {
  const slots =
    topicIds?.length === 0
      ? []
      : await db
          .select()
          .from(topicSlotTable)
          .where(topicIds && inArray(topicSlotTable.topicId, topicIds))
          .orderBy(asc(topicSlotTable.key));
  const byTopic = new Map<string, Slot[]>();
  for (const slot of slots) {
    byTopic.set(slot.topicId, [...(byTopic.get(slot.topicId) ?? []), slot]);
  }
  return byTopic;
}

/** What a reader of a topic is told about its slots. */
export const slotHeads = (slots: Slot[] = []) =>
  slots.map(({ key, name, type, options }) => ({ key, name, type, options }));

/** Changes when a slot is added, removed or redefined. */
export const slotsHash = (slots: Slot[]) =>
  createHash("sha256")
    .update(
      slots
        .map(({ key, type, options }) => [key, type, ...(options ?? [])])
        .map((slot) => JSON.stringify(slot))
        .sort()
        .join("\n"),
    )
    .digest("hex");

export async function listSlots(
  workspaceId: string,
  topicId: string,
  userId: string,
) {
  const topic = await getTopic(workspaceId, topicId, userId);
  return ((await slotsOf([topic.id])).get(topic.id) ?? []).map(shown);
}

export async function createSlot(
  workspaceId: string,
  topicId: string,
  userId: string,
  body: z.infer<typeof createSlotBody>,
) {
  const topic = await getTopic(workspaceId, topicId, userId);
  await assertTopicOwner(workspaceId, topic, userId);
  const key = body.key || keyFrom(body.name);
  if (!KEY.test(key)) {
    throw new HTTPException(400, {
      message:
        "Give the slot a key of lower-case letters, digits and underscores that starts with a letter",
    });
  }
  if (body.type === "enum" && (body.options?.length ?? 0) < 2) {
    throw new HTTPException(400, {
      message: "An enum slot needs two or more options",
    });
  }
  const [slot] = await db
    .insert(topicSlotTable)
    .values({
      topicId: topic.id,
      key,
      name: body.name,
      type: body.type,
      options: body.type === "enum" ? body.options : null,
      createdBy: userId,
    })
    .onConflictDoNothing()
    .returning();
  if (!slot) {
    throw new HTTPException(409, {
      message: "This topic already has a slot with that key",
    });
  }
  return shown(slot);
}

// Removing a slot removes its statements with it.
export async function deleteSlot(
  workspaceId: string,
  topicId: string,
  slotId: string,
  userId: string,
) {
  const topic = await getTopic(workspaceId, topicId, userId);
  await assertTopicOwner(workspaceId, topic, userId);
  const [slot] = await db
    .delete(topicSlotTable)
    .where(
      and(eq(topicSlotTable.id, slotId), eq(topicSlotTable.topicId, topic.id)),
    )
    .returning({ id: topicSlotTable.id });
  if (!slot) throw new HTTPException(404, { message: "Slot not found" });
  return slot;
}
