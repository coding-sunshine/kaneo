import type { z } from "zod";
import db from "../../database";
import { type TopicScope, topicTable } from "../../database/schema";
import { resolveParent } from "../../document/controllers/resolve-parent";
import type { createTopicBody } from "../schema";
import { assertDeciders } from "./assert-deciders";
import { getTopic } from "./get-topic";

export async function createTopic(
  userId: string,
  body: z.infer<typeof createTopicBody>,
) {
  const scope: TopicScope =
    body.scope ??
    (body.workProjectId ? "project" : body.projectId ? "team" : "workspace");
  // A topic lives where a document can, so the same check places it.
  const place = await resolveParent(body.workspaceId, userId, {
    scope,
    projectId: body.projectId,
    workProjectId: body.workProjectId,
  });
  // Whoever creates a topic decides on it until someone else is named.
  const deciderId = body.deciderId ?? userId;
  const backupDeciderId = body.backupDeciderId ?? null;
  await assertDeciders(body.workspaceId, place, deciderId, backupDeciderId);

  const [created] = await db
    .insert(topicTable)
    .values({
      workspaceId: body.workspaceId,
      name: body.name,
      scope,
      projectId: place.projectId,
      workProjectId: place.workProjectId,
      deciderId,
      backupDeciderId,
      creatorId: userId,
    })
    .returning({ id: topicTable.id });
  if (!created) throw new Error("Topic insert returned no row");
  return getTopic(body.workspaceId, created.id, userId);
}
