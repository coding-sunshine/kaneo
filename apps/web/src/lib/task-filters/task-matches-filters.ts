import {
  addWeeks,
  type Day,
  endOfWeek,
  isWithinInterval,
  startOfWeek,
} from "date-fns";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { DUE_DATE_FILTER_VALUES } from "./due-date-filter-values";
import type Task from "@/types/task";
import { matchesDateCondition, parseDateCondition } from "./date-condition";
import { matchesCreated } from "./created-filter";
import { customFieldSubjectId } from "./filter-subject-id";
import { matchesStatusAge } from "./status-age";

export type TaskFilterContext = {
  query?: string;
  projectSlug?: string;
  descriptionMatches?: ReadonlySet<string>;
  weekStartsOn: Day;
  today: Date;
  labelIds?: ReadonlySet<string>;
  /** Task IDs blocked by at least one open "blocks" relation. */
  blockedTaskIds?: ReadonlySet<string>;
  getCustomFieldValues: (
    taskId: string,
  ) => Array<{ fieldId: string; value: string | null }>;
};

function matchesQuery(task: Task, context: TaskFilterContext) {
  const query = context.query?.trim().toLowerCase();
  if (!query) return true;

  const taskNumber = task.number?.toString() ?? "";
  const identifier =
    taskNumber && context.projectSlug
      ? `${context.projectSlug}-${taskNumber}`.toLowerCase()
      : "";

  return (
    context.descriptionMatches?.has(task.id) ||
    (task.title?.toLowerCase() ?? "").includes(query) ||
    (task.description?.toLowerCase() ?? "").includes(query) ||
    taskNumber.includes(query) ||
    (identifier !== "" && identifier.startsWith(query)) ||
    (taskNumber !== "" && `#${taskNumber}`.startsWith(query))
  );
}

function matchesDueDate(
  task: Task,
  dueDateFilter: string,
  context: TaskFilterContext,
) {
  if (dueDateFilter === DUE_DATE_FILTER_VALUES.noDueDate) return !task.dueDate;
  if (!task.dueDate) return false;
  const condition = parseDateCondition(dueDateFilter);
  if (condition) return matchesDateCondition(task.dueDate, condition);

  const weeksAhead =
    dueDateFilter === DUE_DATE_FILTER_VALUES.dueThisWeek
      ? 0
      : dueDateFilter === DUE_DATE_FILTER_VALUES.dueNextWeek
        ? 1
        : null;
  if (weeksAhead === null) return false;

  const reference = addWeeks(context.today, weeksAhead);
  return isWithinInterval(new Date(task.dueDate), {
    start: startOfWeek(reference, { weekStartsOn: context.weekStartsOn }),
    end: endOfWeek(reference, { weekStartsOn: context.weekStartsOn }),
  });
}

export function taskMatchesFilters(
  task: Task,
  filters: BoardFilters,
  context: TaskFilterContext,
) {
  if (!matchesQuery(task, context)) return false;

  const negated = new Set(filters.negated ?? []);
  // One result per active filter; "match all" ANDs them, "match any" ORs them.
  const results: boolean[] = [];
  const handled = new Set<string>();
  // Missing dates only match an explicit, positive "No date" selection.
  for (const field of ["startDate", "dueDate"] as const) {
    if (filters[field]?.length && !task[field]) {
      const noDate =
        field === "dueDate" ? DUE_DATE_FILTER_VALUES.noDueDate : "noDate";
      results.push(!negated.has(field) && !!filters[field]?.includes(noDate));
      handled.add(field);
    }
  }
  const passes = (subject: string, matches: boolean) =>
    negated.has(subject) ? !matches : matches;
  const checks: Array<[string, string[] | null | undefined, () => boolean]> = [
    [
      "status",
      filters.status,
      () => filters.status?.includes(task.status) ?? false,
    ],
    [
      "priority",
      filters.priority,
      () => filters.priority?.includes(task.priority ?? "") ?? false,
    ],
    [
      "assignee",
      filters.assignee,
      () => filters.assignee?.includes(task.userId ?? "") ?? false,
    ],
    [
      "dueDate",
      filters.dueDate,
      () =>
        filters.dueDate?.some((value) =>
          matchesDueDate(task, value, context),
        ) ?? false,
    ],
    [
      "startDate",
      filters.startDate,
      () =>
        filters.startDate?.some((value) => {
          if (value === "noDate") return !task.startDate;
          const condition = parseDateCondition(value);
          return (
            !!task.startDate &&
            !!condition &&
            matchesDateCondition(task.startDate, condition)
          );
        }) ?? false,
    ],
    [
      "createdAt",
      filters.createdAt,
      () =>
        filters.createdAt?.some((value) =>
          matchesCreated(task.createdAt, value, context.today),
        ) ?? false,
    ],
    [
      "cycle",
      filters.cycle,
      () => filters.cycle?.includes(task.cycleId ?? "") ?? false,
    ],
    [
      "estimate",
      filters.estimate,
      () =>
        filters.estimate?.includes(String(task.estimate ?? "none")) ?? false,
    ],
    [
      "workProject",
      filters.workProject,
      () => filters.workProject?.includes(task.workProjectId ?? "") ?? false,
    ],
    [
      "statusAge",
      filters.statusAge,
      () =>
        filters.statusAge?.some((value) =>
          matchesStatusAge(task, value, context.today),
        ) ?? false,
    ],
    [
      "labels",
      filters.labels,
      () =>
        (task.labels ?? []).some((label) =>
          context.labelIds
            ? context.labelIds.has(label.id)
            : filters.labels?.includes(label.id),
        ),
    ],
  ];

  for (const [subject, values, matches] of checks) {
    if (values?.length && !handled.has(subject))
      results.push(passes(subject, matches()));
  }

  if (filters.workable) {
    results.push(
      passes("workable", !(context.blockedTaskIds?.has(task.id) ?? false)),
    );
  }

  if (filters.blocked) {
    results.push(
      passes("blocked", context.blockedTaskIds?.has(task.id) ?? false),
    );
  }

  const fieldValues = filters.customFields
    ? context.getCustomFieldValues(task.id)
    : [];
  for (const [fieldId, allowed] of Object.entries(filters.customFields ?? {})) {
    if (allowed.length === 0) continue;
    const value = fieldValues.find((entry) => entry.fieldId === fieldId)?.value;
    const matches = value != null && value !== "" && allowed.includes(value);
    results.push(passes(customFieldSubjectId(fieldId), matches));
  }

  if (results.length === 0) return true;
  return filters.matchAny ? results.some(Boolean) : results.every(Boolean);
}
