import { HTTPException } from "hono/http-exception";
import { audienceOf } from "../../document/controllers/document-audience";

type Place = {
  scope: string;
  projectId: string | null;
  workProjectId: string | null;
};

// A decider must be able to read what they are asked to approve, so only a
// person who can open the topic's place can be named.
export async function assertDeciders(
  workspaceId: string,
  place: Place,
  deciderId: string | null,
  backupDeciderId: string | null,
) {
  if (deciderId && deciderId === backupDeciderId) {
    throw new HTTPException(400, {
      message: "The backup decider must be a second person",
    });
  }
  const named = [deciderId, backupDeciderId].filter(
    (id): id is string => id !== null,
  );
  if (!named.length) return;
  const audience = await audienceOf(workspaceId, {
    id: null,
    creatorId: null,
    scope: place.scope,
    projectId: place.projectId,
    workProjectId: place.workProjectId,
    taskId: null,
  });
  const canOpen = new Set(audience.map((person) => person.userId));
  if (named.some((id) => !canOpen.has(id))) {
    throw new HTTPException(400, {
      message: "Only a person who can open the topic can decide on it",
    });
  }
}
