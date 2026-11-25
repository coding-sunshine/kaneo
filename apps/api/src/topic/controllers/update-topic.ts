import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import { topicTable } from "../../database/schema";
import type { updateTopicBody } from "../schema";
import { assertDeciders } from "./assert-deciders";
import { addFollowers } from "./follow-topic";
import { getTopic, isWorkspaceOwner } from "./get-topic";

export async function updateTopic(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof updateTopicBody>,
) {
  const topic = await getTopic(workspaceId, id, userId);
  // The backup decider approves in the decider's absence and nothing more.
  if (
    topic.deciderId !== userId &&
    !(await isWorkspaceOwner(workspaceId, userId))
  ) {
    throw new HTTPException(403, {
      message: "Only the topic's decider or a workspace owner can change it",
    });
  }
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
