import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createView, deleteView } from "@/fetchers/view/views";
import { viewsKey } from "@/hooks/queries/view/use-views";
import { favoritesKey } from "@/hooks/queries/favorite/use-favorites";

export function useCreateView(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createView,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewsKey(workspaceId) }),
  });
}

export function useDeleteView(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteView(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewsKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: favoritesKey(workspaceId) });
    },
  });
}
