import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getFiles } from "@/fetchers/file-library/get-files";

export const filesKey = (workspaceId: string) => ["file-library", workspaceId];

export function useFiles(workspaceId: string, query: string | undefined) {
  return useQuery({
    queryKey: [...filesKey(workspaceId), query ?? ""],
    queryFn: () => getFiles(workspaceId, query),
    placeholderData: keepPreviousData,
  });
}
