import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client.document.workspace[":workspaceId"]["issue-files"];

export async function getIssueFiles(workspaceId: string, topicId?: string) {
  const response = await api.$get({
    param: { workspaceId },
    query: { topicId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type IssueFile = Awaited<ReturnType<typeof getIssueFiles>>[number];

export async function getIssueFileAudience(
  workspaceId: string,
  assetId: string,
  topicId: string,
) {
  const response = await api[":assetId"].audience.$get({
    param: { workspaceId, assetId },
    query: { topicId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function proposeIssueFile(
  workspaceId: string,
  assetId: string,
  topicId: string,
) {
  const response = await api[":assetId"].propose.$post({
    param: { workspaceId, assetId },
    json: { topicId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
