import type { ProjectWithTasks } from "@/types/project";

export type GroupBy =
  | "none"
  | "status"
  | "priority"
  | "assignee"
  | "label"
  | "project";

export const GROUP_BY_OPTIONS: GroupBy[] = [
  "none",
  "status",
  "assignee",
  "priority",
  "label",
  "project",
];
export const GROUP_ID_PREFIX = "group:";
export const FLAT_GROUP_ID = `${GROUP_ID_PREFIX}all`;

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "no-priority"];

/**
 * Re-buckets a project's tasks into pseudo columns for the list view. Ids are
 * prefixed so nothing mistakes a group for a real status.
 */
export function groupProjectBy(
  project: ProjectWithTasks,
  groupBy: GroupBy,
  label: (key: string) => string,
  workProjectName: (id: string) => string | undefined = () => undefined,
): ProjectWithTasks {
  if (groupBy === "status" || project.columns.length === 0) return project;
  const base = project.columns[0];
  const tasks = project.columns.flatMap((column) => column.tasks);
  const buckets = new Map<string, { name: string; tasks: typeof tasks }>();
  const put = (key: string, name: string, task: (typeof tasks)[number]) => {
    const bucket = buckets.get(key) ?? { name, tasks: [] };
    bucket.tasks.push(task);
    buckets.set(key, bucket);
  };

  for (const task of tasks) {
    if (groupBy === "none") {
      put("all", label("display.allIssues"), task);
    } else if (groupBy === "label") {
      const labels = task.labels?.length ? task.labels : [undefined];
      for (const l of labels) {
        // Labels are stored per task, so the name is the only shared key.
        put(l?.name ?? "none", l?.name ?? label("display.noLabel"), task);
      }
    } else if (groupBy === "priority") {
      const key = task.priority || "no-priority";
      put(key, label(`priority.${key}`), task);
    } else if (groupBy === "project") {
      const id = task.workProjectId;
      put(
        id ?? "none",
        (id && workProjectName(id)) || label("display.noProject"),
        task,
      );
    } else {
      put(
        task.assigneeId ?? "none",
        task.assigneeName ?? label("display.unassigned"),
        task,
      );
    }
  }

  const keys = [...buckets.keys()].sort((a, b) =>
    groupBy === "priority"
      ? PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b)
      : a === "none"
        ? 1
        : b === "none"
          ? -1
          : buckets.get(a)!.name.localeCompare(buckets.get(b)!.name),
  );

  return {
    ...project,
    columns: keys.map((key) => ({
      ...base,
      id: `${GROUP_ID_PREFIX}${key}`,
      name: buckets.get(key)!.name,
      icon:
        groupBy === "priority"
          ? "Flag"
          : groupBy === "label"
            ? "Tag"
            : groupBy === "project"
              ? "Box"
              : "User",
      isFinal: false,
      tasks: buckets.get(key)!.tasks,
    })),
  };
}
