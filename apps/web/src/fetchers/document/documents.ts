import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client.document.workspace[":workspaceId"];
const one = api[":id"];

export type DocumentFilter = "recent" | "mine" | "shared" | "unfiled" | "inbox";
export type DocumentParent = {
  projectId?: string;
  workProjectId?: string;
  taskId?: string;
};
export type DocumentListQuery = {
  filter?: DocumentFilter;
  topicId?: string;
  /** Documents linked with this issue, in the text of either. */
  linkedTaskId?: string;
} & DocumentParent;
export type DocumentAccess = "edit" | "comment" | "view";
export type DocumentScope =
  | "private"
  | "workspace"
  | "team"
  | "project"
  | "issue";

export async function getDocuments(
  workspaceId: string,
  query: DocumentListQuery = {},
) {
  const response = await api.$get({ param: { workspaceId }, query });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentSummary = Awaited<ReturnType<typeof getDocuments>>[number];

export async function getDocument(workspaceId: string, id: string) {
  const response = await one.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentDetail = Awaited<ReturnType<typeof getDocument>>;

export async function createDocument(
  input: { workspaceId: string; title?: string; content?: string } & {
    projectId?: string | null;
    workProjectId?: string | null;
    taskId?: string | null;
  },
) {
  const response = await client.document.$post({ json: input });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateDocument(
  workspaceId: string,
  id: string,
  json: {
    title?: string;
    content?: string;
    icon?: string | null;
    color?: string | null;
    generalAccess?: DocumentAccess;
    kind?: DocumentDetail["kind"];
  },
) {
  const response = await one.$patch({ param: { workspaceId, id }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function moveDocument(
  workspaceId: string,
  id: string,
  json: {
    scope: DocumentScope;
    projectId?: string | null;
    workProjectId?: string | null;
    taskId?: string | null;
  },
) {
  const response = await one.location.$put({
    param: { workspaceId, id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteDocument(workspaceId: string, id: string) {
  const response = await one.$delete({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function restoreDocument(workspaceId: string, id: string) {
  const response = await one.restore.$post({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function shareDocument(
  workspaceId: string,
  id: string,
  userId: string,
  access: DocumentAccess | null,
) {
  const param = { workspaceId, id, userId };
  if (!access) {
    const response = await one.share[":userId"].$delete({ param });
    if (!response.ok) throw await HttpError.fromResponse(response);
    return response.json();
  }
  const response = await one.share[":userId"].$put({
    param,
    json: { access },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getDocumentTaskAudience(
  workspaceId: string,
  id: string,
  taskId: string,
) {
  const response = await one.task[":taskId"].audience.$get({
    param: { workspaceId, id, taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function shareDocumentWithTask(
  workspaceId: string,
  id: string,
  taskId: string,
) {
  const response = await one.task[":taskId"].share.$put({
    param: { workspaceId, id, taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function unshareDocumentFromTask(
  workspaceId: string,
  id: string,
  taskId: string,
) {
  const response = await one.task[":taskId"].share.$delete({
    param: { workspaceId, id, taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setDocumentSubscribers(
  workspaceId: string,
  id: string,
  userIds: string[],
) {
  const response = await one.subscribers.$put({
    param: { workspaceId, id },
    json: { userIds },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** A place a document could live in: the query the audience route takes. */
export type DocumentPlaceQuery = { scope?: DocumentScope } & DocumentParent;

/** Who can open the document now, and who could after a move to `place`. */
export async function getDocumentAudience(
  workspaceId: string,
  id: string,
  place: DocumentPlaceQuery = {},
) {
  const response = await one.audience.$get({
    param: { workspaceId, id },
    query: place,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentAudience = Awaited<ReturnType<typeof getDocumentAudience>>;

export async function getDocumentVersions(workspaceId: string, id: string) {
  const response = await one.versions.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentVersion = Awaited<
  ReturnType<typeof getDocumentVersions>
>[number];

export async function restoreDocumentVersion(
  workspaceId: string,
  id: string,
  versionId: string,
) {
  const response = await one.versions[":versionId"].restore.$post({
    param: { workspaceId, id, versionId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getDocumentComments(workspaceId: string, id: string) {
  const response = await one.comments.$get({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DocumentComment = Awaited<
  ReturnType<typeof getDocumentComments>
>[number];

export async function createDocumentComment(
  workspaceId: string,
  id: string,
  json: {
    content: string;
    parentId?: string | null;
    quotedText?: string | null;
  },
) {
  const response = await one.comments.$post({
    param: { workspaceId, id },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateDocumentComment(
  workspaceId: string,
  id: string,
  commentId: string,
  json: { content?: string; resolved?: boolean },
) {
  const response = await one.comments[":commentId"].$patch({
    param: { workspaceId, id, commentId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteDocumentComment(
  workspaceId: string,
  id: string,
  commentId: string,
) {
  const response = await one.comments[":commentId"].$delete({
    param: { workspaceId, id, commentId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Make a member the author of the private documents of somebody who left. */
export async function handOverDocuments(
  workspaceId: string,
  fromUserId: string,
  toUserId: string,
) {
  const response = await api["hand-over"].$post({
    param: { workspaceId },
    json: { fromUserId, toUserId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Private documents whose author left. Workspace owners only. */
export async function getOwnerlessDocuments(workspaceId: string) {
  const response = await api.ownerless.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function takeOverDocument(workspaceId: string, id: string) {
  const response = await one["take-over"].$post({ param: { workspaceId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Set a document aside in the Inbox until a time; null brings it back. */
export async function snoozeDocument(
  workspaceId: string,
  id: string,
  until: string | null,
) {
  const response = await one.snooze.$post({
    param: { workspaceId, id },
    json: { until },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Say whether a document is a revision of the older one it resembles. */
export async function decideDocumentLineage(
  workspaceId: string,
  id: string,
  status: "confirmed" | "dismissed",
) {
  const response = await one.lineage.$put({
    param: { workspaceId, id },
    json: { status },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** Proposals and new current documents on followed topics since the last visit. */
export async function getNewDocuments(workspaceId: string) {
  const response = await api.$get({
    param: { workspaceId },
    query: { filter: "new" },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function markDocumentsSeen(workspaceId: string, until: string) {
  const response = await api.seen.$post({
    param: { workspaceId },
    json: { until },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
