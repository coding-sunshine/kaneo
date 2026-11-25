import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client.topic.workspace[":workspaceId"];
const filed = api[":id"].document[":documentId"];

export async function getTopics(workspaceId: string) {
  const response = await api.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type Topic = Awaited<ReturnType<typeof getTopics>>[number];

export async function getTopic(workspaceId: string, id: string) {
  const response = await api[":id"].$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createTopic(json: {
  workspaceId: string;
  name: string;
  projectId?: string;
}) {
  const response = await client.topic.$post({ json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setTopicFollowed(
  workspaceId: string,
  id: string,
  follow: boolean,
) {
  const request = { param: { workspaceId, id } };
  const response = follow
    ? await api[":id"].follow.$put(request)
    : await api[":id"].follow.$delete(request);
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** A document under a topic: the ids every decision on it needs. */
export type TopicDocument = {
  workspaceId: string;
  id: string;
  documentId: string;
};

export async function fileDocumentOnTopic(param: TopicDocument) {
  const response = await filed.$put({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function makeDocumentCurrent(
  param: TopicDocument,
  reason: string,
) {
  const response = await filed.current.$post({ param, json: { reason } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function confirmCurrentDocument(param: TopicDocument) {
  const response = await filed.confirm.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setCurrentDocumentAside(param: TopicDocument) {
  const response = await filed["set-aside"].$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
