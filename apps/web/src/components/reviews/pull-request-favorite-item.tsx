import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuItem } from "@/components/ui/menu";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useFavorite } from "@/hooks/queries/favorite/use-favorites";
import { pullRequestKey } from "@/lib/pull-request-key";

/** Menu item that favorites the pull request in the sidebar. */
export function PullRequestFavoriteItem({
  pullRef,
  workspaceId,
}: {
  pullRef: PullRef;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const { isFavorite, toggle } = useFavorite(workspaceId, {
    type: "pullRequest",
    targetId: pullRequestKey(pullRef),
  });
  return (
    <MenuItem onClick={toggle}>
      <Star />
      {t(
        isFavorite
          ? "workspace:reviews.prActions.unfavorite"
          : "workspace:reviews.prActions.favorite",
      )}
    </MenuItem>
  );
}
