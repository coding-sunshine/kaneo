import { Link } from "@tanstack/react-router";
import { Layers2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { getViews } from "@/fetchers/view/views";

type SavedView = Awaited<ReturnType<typeof getViews>>[number];

type ViewListProps = {
  workspaceId: string;
  views: SavedView[];
};

/** Linear's Views list: one row per saved view, opening it. */
export function ViewList({ workspaceId, views }: ViewListProps) {
  const { t } = useTranslation();

  if (views.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-16 text-center">
        <p className="text-sm font-medium">{t("navigation:views.empty")}</p>
        <p className="text-sm text-muted-foreground">
          {t("navigation:views.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {views.map((view) => (
        <li key={view.id}>
          <Link
            to="/dashboard/workspace/$workspaceId/views/$viewId"
            params={{ workspaceId, viewId: view.id }}
            className="flex h-11 items-center gap-3 border-border/60 border-b px-4 text-[13px] hover:bg-accent/50"
          >
            <Layers2 className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {view.name}
            </span>
            <span className="text-muted-foreground">
              {view.visibility === "personal"
                ? t("navigation:views.scopePersonal")
                : view.projectId === null
                  ? t("navigation:views.scopeWorkspace")
                  : t("navigation:views.scopeTeam")}
            </span>
            <span className="w-32 truncate text-right text-muted-foreground">
              {view.ownerName}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
