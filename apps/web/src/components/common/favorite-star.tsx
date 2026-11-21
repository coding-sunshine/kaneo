import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFavorite } from "@/hooks/queries/favorite/use-favorites";
import type { FavoriteTarget } from "@/fetchers/favorite";
import { cn } from "@/lib/cn";

/** Linear's header star: an "Add to favorites" switch next to the page name. */
export function FavoriteStar({
  workspaceId,
  target,
}: {
  workspaceId: string;
  target: FavoriteTarget;
}) {
  const { t } = useTranslation();
  const { isFavorite, toggle } = useFavorite(workspaceId, target);
  const label = isFavorite
    ? t("navigation:projectList.removeFavorite")
    : t("navigation:projectList.addFavorite");

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isFavorite}
      aria-label={label}
      title={label}
      onClick={toggle}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Star
        className={cn(
          "size-3.5",
          isFavorite && "fill-amber-400 text-amber-400",
        )}
      />
    </button>
  );
}
