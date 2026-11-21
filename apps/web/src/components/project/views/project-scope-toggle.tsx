import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { IssueView } from "@/lib/status-category";

const TABS: ReadonlyArray<[IssueView, string]> = [
  ["active", "navigation:sidebar.active"],
  ["backlog", "navigation:sidebar.backlog"],
  ["all", "navigation:sidebar.allIssues"],
];

type ProjectScopeToggleProps = {
  workspaceId: string;
  projectId: string;
  /** False on calendar and gantt, where no issue tab applies. */
  highlight: boolean;
};

/** Linear's Active / Backlog / All issues tabs at the top of a team's issues. */
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
      className="flex h-7 shrink-0 items-center gap-1"
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
              "inline-flex h-7 items-center rounded-md border px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-border bg-accent text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
