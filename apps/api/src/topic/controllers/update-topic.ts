import { eq } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { topicTable } from "../../database/schema";
import type { updateTopicBody } from "../schema";
import { assertDeciders } from "./assert-deciders";
import { assertTopicOwner } from "./assert-topic-owner";
import { addFollowers } from "./follow-topic";
import { getTopic } from "./get-topic";

export async function updateTopic(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof updateTopicBody>,
) {
  const topic = await getTopic(workspaceId, id, userId);
  await assertTopicOwner(workspaceId, topic, userId);
  const deciderId = body.deciderId ?? topic.deciderId;
  const backupDeciderId =
    body.backupDeciderId === undefined
      ? topic.backupDeciderId
      : body.backupDeciderId;
  if (body.deciderId !== undefined || body.backupDeciderId !== undefined) {
    await assertDeciders(workspaceId, topic, deciderId, backupDeciderId);
  }

  await db
    .update(topicTable)
    .set({
      name: body.name ?? topic.name,
      deciderId,
      backupDeciderId,
      updatedAt: new Date(),
    })
    .where(eq(topicTable.id, id));
  // A newly named decider or backup follows the topic. They can unfollow.
  await addFollowers(id, [body.deciderId, body.backupDeciderId]);
  return getTopic(workspaceId, id, userId);
}
