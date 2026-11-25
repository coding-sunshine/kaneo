import type { QueryClient } from "@tanstack/react-query";
import type { DocumentListQuery } from "@/fetchers/document/documents";

// A saved description or comment can add or drop a link to a document. Reads
// the lists of linked documents again: one issue's, or every open one when the
// caller does not know the issue.
export function invalidateLinkedDocuments(
  queryClient: QueryClient,
  taskId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: ["documents"],
    predicate: ({ queryKey }) => {
      const linked = (queryKey[3] as DocumentListQuery | undefined)
        ?.linkedTaskId;
      return taskId ? linked === taskId : linked !== undefined;
    },
  });
}
