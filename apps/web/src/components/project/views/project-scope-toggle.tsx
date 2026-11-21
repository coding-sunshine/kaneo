import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { IssueView } from "@/lib/status-category";

const TABS: ReadonlyArray<[IssueView, string]> = [
  ["all", "navigation:sidebar.allIssues"],
  ["active", "navigation:sidebar.active"],
  ["backlog", "navigation:sidebar.backlog"],
];

type ProjectScopeToggleProps = {
  workspaceId: string;
  projectId: string;
  /** False on calendar and gantt, where no issue tab applies. */
  highlight: boolean;
};

/** Linear's All issues / Active / Backlog tabs at the top of a team's issues. */
export function ProjectScopeToggle({
  workspaceId,
  projectId,
  highlight,
}: ProjectScopeToggleProps) {
  const { t } = useTranslation();
  const current = useRouterState({
    select: (state) =>
      (state.location.search as { view?: string }).view ?? "all",
  });

  return (
    <nav
      aria-label={t("tasks:view.heading")}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 dark:bg-input/32"
    >
      {TABS.map(([view, label]) => {
        const active = highlight && current === view;
        return (
          <Link
            key={view}
            to="/dashboard/workspace/$workspaceId/project/$projectId/board"
            params={{ workspaceId, projectId }}
            search={view === "all" ? {} : { view }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-6 items-center rounded-[calc(var(--radius-lg)-3px)] px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-foreground shadow-xs/5"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
