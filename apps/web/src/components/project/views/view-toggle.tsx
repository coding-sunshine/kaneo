import { LayoutGrid, List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { ProjectRoute, ProjectView } from "./project-views";
import { useGoToProjectView } from "./use-go-to-project-view";

type ViewToggleProps = {
  workspaceId: string;
  projectId: string;
  currentRoute: ProjectRoute;
  currentView: ProjectView;
};

const OPTIONS = [
  { id: "list", icon: List, labelKey: "tasks:view.list" },
  { id: "board", icon: LayoutGrid, labelKey: "tasks:view.board" },
] as const;

/** Linear's always-visible List / Board layout switch in the view header. */
export function ViewToggle({
  workspaceId,
  projectId,
  currentRoute,
  currentView,
}: ViewToggleProps) {
  const { t } = useTranslation();
  const goToView = useGoToProjectView({ workspaceId, projectId, currentRoute });

  return (
    <div
      role="group"
      aria-label={t("tasks:display.layout")}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 dark:bg-input/32"
    >
      {OPTIONS.map(({ id, icon: Icon, labelKey }) => {
        const active = id === currentView;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => goToView(id)}
            className={cn(
              "inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-[calc(var(--radius-lg)-3px)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-foreground shadow-xs/5"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
