import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ChildPages,
  createDocument,
  createDocumentComment,
  type DocumentAccess,
  type DocumentDetail,
  decideDocumentLineage,
  deleteDocument,
  deleteDocumentComment,
  moveDocument,
  moveDocumentPage,
  restoreDocument,
  restoreDocumentVersion,
  setDocumentSubscribers,
  shareDocument,
  shareDocumentWithTask,
  snoozeDocument,
  unshareDocumentFromHiddenTasks,
  unshareDocumentFromTask,
  updateDocument,
  updateDocumentComment,
} from "@/fetchers/document/documents";
import {
  documentCommentsKey,
  documentKey,
  documentsKey,
} from "@/hooks/queries/document/use-documents";
import { favoritesKey } from "@/hooks/queries/favorite/use-favorites";

/** Store a fresh document and refresh the lists it may have moved between. */
function useStoreDocument(workspaceId: string) {
  const queryClient = useQueryClient();
  return (document: DocumentDetail | null) => {
    if (document) {
      queryClient.setQueryData(documentKey(workspaceId, document.id), document);
    }
    queryClient.invalidateQueries({
      queryKey: [...documentsKey(workspaceId), "list"],
    });
  };
}

/**
 * A page that gains a child must ask before it is deleted, so its cached
 * `hasChildren` is set now and refetched; the page it left is refetched too.
 */
function useRefreshParents(workspaceId: string) {
  const queryClient = useQueryClient();
  return (gained: string | null | undefined, lost?: string | null) => {
    if (gained) {
      queryClient.setQueryData<DocumentDetail>(
        documentKey(workspaceId, gained),
        (page) => page && { ...page, hasChildren: true },
      );
    }
    for (const id of [gained, lost]) {
      if (id) {
        queryClient.invalidateQueries({
          queryKey: documentKey(workspaceId, id),
          exact: true,
        });
      }
    }
  };
}

export function useCreateDocument(workspaceId: string) {
  const store = useStoreDocument(workspaceId);
  const refreshParents = useRefreshParents(workspaceId);
  return useMutation({
    mutationFn: (
      input: Omit<Parameters<typeof createDocument>[0], "workspaceId">,
    ) => createDocument({ workspaceId, ...input }),
    onSuccess: (document, input) => {
      store(document);
      refreshParents(input.parentDocumentId);
    },
  });
}

export function useUpdateDocument(workspaceId: string, id: string) {
  const store = useStoreDocument(workspaceId);
  return useMutation({
    mutationFn: (json: Parameters<typeof updateDocument>[2]) =>
      updateDocument(workspaceId, id, json),
    onSuccess: store,
  });
}

export function useMoveDocument(workspaceId: string, id: string) {
  const store = useStoreDocument(workspaceId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: Parameters<typeof moveDocument>[2]) =>
      moveDocument(workspaceId, id, json),
    onSuccess: (document) => {
      store(document);
      queryClient.invalidateQueries({
        queryKey: [...documentKey(workspaceId, id), "audience"],
      });
    },
  });
}

export function useShareDocument(workspaceId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      access,
    }: {
      userId: string;
      access: DocumentAccess | null;
    }) => shareDocument(workspaceId, id, userId, access),
    // Removing a share answers with an id only, so refetch either way.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentKey(workspaceId, id) }),
  });
}

export function useShareDocumentWithTask(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: string; taskId: string }) =>
      shareDocumentWithTask(workspaceId, id, taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) }),
  });
}

export function useUnshareDocumentFromTask(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: string; taskId: string }) =>
      unshareDocumentFromTask(workspaceId, id, taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) }),
  });
}

export function useUnshareDocumentFromHiddenTasks(
  workspaceId: string,
  id: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unshareDocumentFromHiddenTasks(workspaceId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) }),
  });
}

export function useDecideDocumentLineage(workspaceId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: Parameters<typeof decideDocumentLineage>[2]) =>
      decideDocumentLineage(workspaceId, id, status),
    onSuccess: (document) =>
      queryClient.setQueryData(documentKey(workspaceId, id), document),
  });
}

export function useSetDocumentSubscribers(workspaceId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      setDocumentSubscribers(workspaceId, id, userIds),
    onSuccess: ({ subscriberIds }) =>
      queryClient.setQueryData<DocumentDetail>(
        documentKey(workspaceId, id),
        (document) => document && { ...document, subscriberIds },
      ),
  });
}

export function useDeleteDocument(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, children }: { id: string; children?: ChildPages }) =>
      deleteDocument(workspaceId, id, children),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: favoritesKey(workspaceId) });
    },
  });
}

export function useMoveDocumentPage(workspaceId: string) {
  const queryClient = useQueryClient();
  const store = useStoreDocument(workspaceId);
  const refreshParents = useRefreshParents(workspaceId);
  return useMutation({
    mutationFn: ({
      id,
      parentDocumentId,
    }: {
      id: string;
      parentDocumentId: string | null;
    }) => moveDocumentPage(workspaceId, id, parentDocumentId),
    // The parent it leaves is the last of its ancestors before the move. A
    // cached page without them must not stop the move.
    onMutate: ({ id }) =>
      queryClient
        .getQueryData<DocumentDetail>(documentKey(workspaceId, id))
        ?.ancestors?.at(-1)?.id,
    onSuccess: (document, { parentDocumentId }, oldParent) => {
      store(document);
      refreshParents(parentDocumentId, oldParent);
    },
  });
}

export function useRestoreDocument(workspaceId: string) {
  const store = useStoreDocument(workspaceId);
  return useMutation({
    mutationFn: (id: string) => restoreDocument(workspaceId, id),
    onSuccess: store,
  });
}

export function useRestoreDocumentVersion(workspaceId: string, id: string) {
  const queryClient = useQueryClient();
  const store = useStoreDocument(workspaceId);
  return useMutation({
    mutationFn: (versionId: string) =>
      restoreDocumentVersion(workspaceId, id, versionId),
    onSuccess: (document) => {
      store(document);
      queryClient.invalidateQueries({
        queryKey: [...documentKey(workspaceId, id), "versions"],
      });
    },
  });
}

function useCommentMutation<TInput>(
  workspaceId: string,
  id: string,
  run: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: documentCommentsKey(workspaceId, id),
      }),
  });
}

export function useCreateDocumentComment(workspaceId: string, id: string) {
  return useCommentMutation(
    workspaceId,
    id,
    (json: Parameters<typeof createDocumentComment>[2]) =>
      createDocumentComment(workspaceId, id, json),
  );
}

export function useUpdateDocumentComment(workspaceId: string, id: string) {
  return useCommentMutation(
    workspaceId,
    id,
    ({
      commentId,
      ...json
    }: { commentId: string } & Parameters<typeof updateDocumentComment>[3]) =>
      updateDocumentComment(workspaceId, id, commentId, json),
  );
}

export function useDeleteDocumentComment(workspaceId: string, id: string) {
  return useCommentMutation(workspaceId, id, (commentId: string) =>
    deleteDocumentComment(workspaceId, id, commentId),
  );
}

export function useSnoozeDocument(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: string | null }) =>
      snoozeDocument(workspaceId, id, until),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...documentsKey(workspaceId), "list"],
      }),
  });
}
