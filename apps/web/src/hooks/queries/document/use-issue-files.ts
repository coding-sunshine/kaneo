import { useQuery } from "@tanstack/react-query";
import {
  getIssueFileAudience,
  getIssueFiles,
} from "@/fetchers/document/issue-files";
import { documentsKey } from "./use-documents";

/** Under the documents prefix, so every document refresh reads them again. */
export const issueFilesKey = (workspaceId: string, topicId?: string) => [
  ...documentsKey(workspaceId),
  "issue-files",
  topicId ?? null,
];

export function useIssueFiles(
  workspaceId: string,
  topicId?: string,
  enabled = true,
) {
  return useQuery({
    enabled: Boolean(workspaceId) && enabled,
    queryKey: issueFilesKey(workspaceId, topicId),
    queryFn: () => getIssueFiles(workspaceId, topicId),
  });
}

/** Who can open the file now and who could open it once proposed on the topic. */
export function useIssueFileAudience(
  workspaceId: string,
  assetId: string,
  topicId: string,
  enabled = true,
) {
  return useQuery({
    enabled: Boolean(workspaceId && assetId && topicId) && enabled,
    queryKey: [
      ...documentsKey(workspaceId),
      "issue-file-audience",
      assetId,
      topicId,
    ],
    queryFn: () => getIssueFileAudience(workspaceId, assetId, topicId),
  });
}
