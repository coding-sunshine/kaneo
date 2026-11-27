import type { DocumentListQuery } from "@/fetchers/document/documents";

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
