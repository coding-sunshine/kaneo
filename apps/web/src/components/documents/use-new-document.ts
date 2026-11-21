import { useNavigate } from "@tanstack/react-router";
import { useCreateDocument } from "@/hooks/mutations/document/use-document-mutations";
import { toast } from "@/lib/toast";

type Parent = { projectId?: string; workProjectId?: string; taskId?: string };

/** Create a document (private unless a parent is given) and open it. */
export function useNewDocument(workspaceId: string) {
  const navigate = useNavigate();
  const mutation = useCreateDocument(workspaceId);
  const create = (parent: Parent = {}) =>
    mutation.mutate(parent, {
      onSuccess: (document) =>
        navigate({
          to: "/dashboard/workspace/$workspaceId/document/$documentId",
          params: { workspaceId, documentId: document.id },
        }),
      onError: (error) => toast.error(error.message),
    });
  return { create, isPending: mutation.isPending };
}
