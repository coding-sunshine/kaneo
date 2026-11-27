import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteDocumentTemplate,
  saveDocumentTemplate,
} from "@/fetchers/document/templates";
import { documentTemplatesKey } from "@/hooks/queries/document/use-document-templates";

function useRefreshTemplates(workspaceId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: documentTemplatesKey(workspaceId),
    });
}

export function useSaveDocumentTemplate(workspaceId: string) {
  const refresh = useRefreshTemplates(workspaceId);
  return useMutation({
    mutationFn: (documentId: string) =>
      saveDocumentTemplate(workspaceId, documentId),
    onSuccess: refresh,
  });
}

export function useDeleteDocumentTemplate(workspaceId: string) {
  const refresh = useRefreshTemplates(workspaceId);
  return useMutation({
    mutationFn: (id: string) => deleteDocumentTemplate(workspaceId, id),
    onSuccess: refresh,
  });
}
