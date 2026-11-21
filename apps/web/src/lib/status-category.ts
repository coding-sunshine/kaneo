import type { ProjectWithTasks } from "@/types/project";

/** Linear's workflow-state types. Kaneo columns carry no type, so it is read from the slug. */
export type StatusCategory =
  | "triage"
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "canceled";

/** Team views: "all" is Linear's Issues tab; Triage never shows in any of them. */
export type IssueView = "all" | "active" | "backlog";

const BY_SLUG: Record<string, StatusCategory> = {
  triage: "triage",
  backlog: "backlog",
  todo: "unstarted",
  "to-do": "unstarted",
  "in-progress": "started",
  "in-review": "started",
  done: "completed",
  canceled: "canceled",
  cancelled: "canceled",
};

export function statusCategory(column: {
  id: string;
  isFinal: boolean;
}): StatusCategory {
  return BY_SLUG[column.id] ?? (column.isFinal ? "completed" : "started");
}

const VIEW_CATEGORIES: Record<IssueView, StatusCategory[]> = {
  all: ["backlog", "unstarted", "started", "completed", "canceled"],
  active: ["unstarted", "started"],
  backlog: ["backlog"],
};

export function scopeProjectToView<T extends Pick<ProjectWithTasks, "columns">>(
  project: T,
  view: IssueView,
): T {
  const allowed = VIEW_CATEGORIES[view];
  return {
    ...project,
    columns: project.columns.filter((column) =>
      allowed.includes(statusCategory(column)),
    ),
  };
}

export function triageTasks(project: Pick<ProjectWithTasks, "columns">) {
  return project.columns
    .filter((column) => statusCategory(column) === "triage")
    .flatMap((column) => column.tasks)
    .filter(
      (task) => !task.snoozedUntil || new Date(task.snoozedUntil) <= new Date(),
    );
}
