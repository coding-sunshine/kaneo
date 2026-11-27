import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setFavorite } from "@/fetchers/favorite";
import {
  favoritesKey,
  useFavorites,
} from "@/hooks/queries/favorite/use-favorites";

/**
 * The documents this person pinned on the Documents page, oldest pin first.
 * A pin is their own, like a favorite, and kept apart from the star.
 */
export function useDocumentPins(workspaceId: string) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useFavorites(workspaceId);
  const pinnedIds = (data ?? [])
    .filter((favorite) => favorite.type === "documentPin")
    .map((favorite) => favorite.targetId);
  const mutation = useMutation({
    mutationFn: async ({ ids, on }: { ids: string[]; on: boolean }) => {
      for (const targetId of ids) {
        await setFavorite(workspaceId, { type: "documentPin", targetId }, on);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: favoritesKey(workspaceId) }),
  });
  return {
    pinnedIds,
    isLoading,
    isPending: mutation.isPending,
    pin: (ids: string[]) =>
      mutation.mutateAsync({
        ids: ids.filter((id) => !pinnedIds.includes(id)),
        on: true,
      }),
    unpin: (id: string) => mutation.mutateAsync({ ids: [id], on: false }),
  };
}
