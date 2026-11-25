import { and, eq } from "drizzle-orm";
import db from "../../database";
import { topicSubscriberTable } from "../../database/schema";
import { getTopic } from "./get-topic";

// Makes these people followers of a topic. Following twice is following
// once. The time comes from this clock, like the times on a document, so
// "filed after I followed" compares like with like.
export async function addFollowers(
  topicId: string,
  userIds: (string | null | undefined)[],
) {
  const createdAt = new Date();
  const values = [...new Set(userIds)].flatMap((userId) =>
    userId ? [{ topicId, userId, createdAt }] : [],
  );
  if (!values.length) return;
  await db.insert(topicSubscriberTable).values(values).onConflictDoNothing();
}

// Anyone who can open a topic can follow it. A topic they cannot open
// answers like one that does not exist.
export async function followTopic(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const topic = await getTopic(workspaceId, id, userId);
  await addFollowers(id, [userId]);
  return { ...topic, following: true };
}

export async function unfollowTopic(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const topic = await getTopic(workspaceId, id, userId);
  await db
    .delete(topicSubscriberTable)
    .where(
      and(
        eq(topicSubscriberTable.topicId, id),
        eq(topicSubscriberTable.userId, userId),
      ),
    );
  return { ...topic, following: false };
}
