import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FavoriteTarget,
  getFavorites,
  setFavorite,
} from "@/fetchers/favorite";

export const favoritesKey = (workspaceId: string) => ["favorites", workspaceId];

export function useFavorites(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: favoritesKey(workspaceId),
    queryFn: () => getFavorites(workspaceId),
  });
}

/** Whether a team or view is favorited, and a toggle that updates the list. */
export function useFavorite(workspaceId: string, target: FavoriteTarget) {
  const queryClient = useQueryClient();
  const { data } = useFavorites(workspaceId);
  const isFavorite = Boolean(
    data?.some(
      (item) => item.type === target.type && item.targetId === target.targetId,
    ),
  );
  const mutation = useMutation({
    mutationFn: (on: boolean) => setFavorite(workspaceId, target, on),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: favoritesKey(workspaceId) }),
  });
  return { isFavorite, toggle: () => mutation.mutate(!isFavorite) };
}
