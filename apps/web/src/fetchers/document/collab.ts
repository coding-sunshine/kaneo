import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const collab = client.document.workspace[":workspaceId"][":id"].collab;

export async function getCollabState(workspaceId: string, id: string) {
  const response = await collab.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function seedCollabState(
  workspaceId: string,
  id: string,
  json: { update: string; baseHash: string },
) {
  const response = await collab.seed.$post({
    param: { workspaceId, id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function sendCollabUpdate(
  workspaceId: string,
  id: string,
  update: string,
) {
  const response = await collab.update.$post({
    param: { workspaceId, id },
    json: { update },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function sendCollabAwareness(
  workspaceId: string,
  id: string,
  update: string,
) {
  const response = await collab.awareness.$post({
    param: { workspaceId, id },
    json: { update },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Saves the Markdown of the co-edited text; `baseHash` only after review. */
export async function saveCoeditedText(
  workspaceId: string,
  id: string,
  json: { content: string; baseHash?: string },
) {
  const response = await collab.text.$put({ param: { workspaceId, id }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
