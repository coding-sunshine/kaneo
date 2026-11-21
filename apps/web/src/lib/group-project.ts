import type { ProjectWithTasks } from "@/types/project";
import { type StatusCategory, statusCategory } from "./status-category";

export type GroupBy =
  | "none"
  | "status"
  | "priority"
  | "assignee"
  | "label"
  | "project"
  | "cycle"
  | "status-type";

export const GROUP_BY_OPTIONS: GroupBy[] = [
  "none",
  "status",
  "assignee",
  "priority",
  "label",
  "project",
  "cycle",
  "status-type",
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
  cycleName: (id: string) => string | undefined = () => undefined,
): ProjectWithTasks {
  if (groupBy === "status" || project.columns.length === 0) return project;
  if (groupBy === "status-type") return groupByStatusType(project, label);
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
    } else if (groupBy === "cycle") {
      const id = task.cycleId;
      put(
        id ?? "none",
        (id && cycleName(id)) || label("display.noCycle"),
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
          : buckets
              .get(a)!
              .name.localeCompare(buckets.get(b)!.name, undefined, {
                numeric: true,
              }),
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
              : groupBy === "cycle"
                ? "CirclePlay"
                : "User",
      isFinal: false,
      tasks: buckets.get(key)!.tasks,
    })),
  };
}

const STATUS_TYPE_ORDER: StatusCategory[] = [
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
];

/** One group per Linear workflow-state type, in workflow order. */
function groupByStatusType(
  project: ProjectWithTasks,
  label: (key: string) => string,
): ProjectWithTasks {
  const base = project.columns[0];
  const columns = STATUS_TYPE_ORDER.flatMap((category) => {
    const tasks = project.columns
      .filter((column) => statusCategory(column) === category)
      .flatMap((column) => column.tasks);
    if (tasks.length === 0) return [];
    return [
      {
        ...base,
        id: `${GROUP_ID_PREFIX}${category}`,
        name: label(`display.statusType.${category}`),
        icon: base.icon,
        isFinal: category === "completed" || category === "canceled",
        tasks,
      },
    ];
  });
  return { ...project, columns };
}

/** Linear offers every grouping except status type as a sub-grouping. */
export const SUB_GROUP_BY_OPTIONS: GroupBy[] = GROUP_BY_OPTIONS.filter(
  (option) => option !== "status-type",
);

type SubGroupTask = {
  status?: string | null;
  priority?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  workProjectId?: string | null;
  cycleId?: string | null;
  labels?: { name: string }[] | null;
};

/**
 * Splits one section's rows into sub-groups, in the order Grouping uses.
 * A nested subtask row stays under the top-level row that repeats it.
 */
export function subGroupRows<T extends { task: SubGroupTask; depth: number }>(
  rows: T[],
  by: GroupBy,
  name: (key: string, task: T["task"]) => string,
): { key: string; name: string; rows: T[] }[] {
  const buckets = new Map<string, { name: string; rows: T[] }>();
  let current: { name: string; rows: T[] } | undefined;
  for (const row of rows) {
    if (row.depth === 0 || !current) {
      const task = row.task;
      const key =
        by === "status"
          ? (task.status ?? "none")
          : by === "priority"
            ? task.priority || "no-priority"
            : by === "assignee"
              ? (task.assigneeId ?? "none")
              : by === "project"
                ? (task.workProjectId ?? "none")
                : by === "cycle"
                  ? (task.cycleId ?? "none")
                  : by === "label"
                    ? (task.labels?.[0]?.name ?? "none")
                    : "all";
      current = buckets.get(key) ?? { name: name(key, task), rows: [] };
      buckets.set(key, current);
    }
    current.rows.push(row);
  }
  const keys = [...buckets.keys()].sort((a, b) =>
    by === "priority"
      ? PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b)
      : a === "none"
        ? 1
        : b === "none"
          ? -1
          : buckets
              .get(a)!
              .name.localeCompare(buckets.get(b)!.name, undefined, {
                numeric: true,
              }),
  );
  return keys.map((key) => ({ key, ...buckets.get(key)! }));
}
