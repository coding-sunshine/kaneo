import { useQuery } from "@tanstack/react-query";
import { getDocumentTemplates } from "@/fetchers/document/templates";

export const documentTemplatesKey = (workspaceId: string) => [
  "documentTemplates",
  workspaceId,
];

export function useDocumentTemplates(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: documentTemplatesKey(workspaceId),
    queryFn: () => getDocumentTemplates(workspaceId),
  });
}
