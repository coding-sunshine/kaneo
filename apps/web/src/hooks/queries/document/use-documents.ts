import { useQuery } from "@tanstack/react-query";
import {
  type DocumentListQuery,
  getDocument,
  getDocumentComments,
  getDocuments,
  getDocumentVersions,
} from "@/fetchers/document/documents";

/** Every document query in a workspace shares this prefix. */
export const documentsKey = (workspaceId: string) => ["documents", workspaceId];
export const documentListKey = (
  workspaceId: string,
  query: DocumentListQuery = {},
) => [...documentsKey(workspaceId), "list", query];
export const documentKey = (workspaceId: string, id: string) => [
  ...documentsKey(workspaceId),
  "one",
  id,
];

export function useDocuments(
  workspaceId: string,
  query: DocumentListQuery = {},
  enabled = true,
) {
  return useQuery({
    enabled: Boolean(workspaceId) && enabled,
    queryKey: documentListKey(workspaceId, query),
    queryFn: () => getDocuments(workspaceId, query),
  });
}

export function useDocument(workspaceId: string, id: string) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: documentKey(workspaceId, id),
    queryFn: () => getDocument(workspaceId, id),
    retry: false,
  });
}

export function useDocumentVersions(
  workspaceId: string,
  id: string,
  enabled: boolean,
) {
  return useQuery({
    enabled: Boolean(workspaceId && id) && enabled,
    queryKey: [...documentKey(workspaceId, id), "versions"],
    queryFn: () => getDocumentVersions(workspaceId, id),
  });
}

export const documentCommentsKey = (workspaceId: string, id: string) => [
  ...documentKey(workspaceId, id),
  "comments",
];

export function useDocumentComments(workspaceId: string, id: string) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: documentCommentsKey(workspaceId, id),
    queryFn: () => getDocumentComments(workspaceId, id),
  });
}
