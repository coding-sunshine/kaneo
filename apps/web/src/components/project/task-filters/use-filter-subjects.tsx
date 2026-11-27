import {
  OLDER_THAN_PRESETS,
  olderThanValue,
  parseOlderThan,
} from "@/lib/task-filters/created-filter";
import { parseDateCondition } from "@/lib/task-filters/date-condition";
import { formatDateCondition } from "./format-date-condition";
import {
  Box,
  CalendarDays,
  CircleCheck,
  CircleSlash,
  Clock,
  CircleDot,
  CirclePlay,
  Hourglass,
  Layers,
  Tag,
  UserRound,
  Hexagon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cycleTitle } from "@/lib/cycle/cycle-label";
import { getColumnIcon } from "@/lib/column";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { countValues } from "@/lib/task-filters/count-values";
import { DUE_DATE_OPTIONS } from "@/lib/task-filters/due-date-options";
import {
  matchesStatusAge,
  parseStatusAge,
  STATUS_AGE_DAYS,
  serializeStatusAge,
} from "@/lib/task-filters/status-age";
import { customFieldSubjectId } from "@/lib/task-filters/filter-subject-id";
import {
  groupLabels,
  isLabelGroupSelected,
  labelGroupKey,
  toggleLabelGroup,
} from "@/lib/task-filters/label-groups";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { customFieldIcon } from "@/components/custom-fields/custom-field-icon";
import { formatCustomFieldValue } from "@/components/custom-fields/format-custom-field-value";
import { WorkProjectIcon } from "@/components/work-project/work-project-icon";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";
import type { FilterSubject, TaskFilterControls } from "./filter-subject";
import { LabelFilterDot } from "./label-filter-dot";
import { MemberFilterAvatar } from "./member-filter-avatar";
import { operatorLabels } from "./operator-labels";
import type { TaskFilterOptions } from "./use-task-filter-options";

const PRIORITIES = ["urgent", "high", "medium", "low"];

type UseFilterSubjectsInput = {
  controls: TaskFilterControls;
  options: TaskFilterOptions;
  columns?: ProjectWithTasks["columns"];
  tasks: Task[];
  showStatus: boolean;
};

export function useFilterSubjects({
  controls,
  options,
  columns = [],
  tasks,
  showStatus,
}: UseFilterSubjectsInput): FilterSubject[] {
  const { t } = useTranslation();
  const { filters, toggleFilter, updateFilter, setNegated } = controls;
  const empty = t("tasks:boardFilters.noValuesUsedYet");
  const negated = new Set(filters.negated ?? []);

  const subject = (
    id: string,
    fields: Pick<FilterSubject, "label" | "icon" | "options" | "selected"> &
      Partial<FilterSubject>,
    operatorKind: "is" | "include" = "is",
  ): FilterSubject => ({
    id,
    kind: "core",
    operators: operatorLabels(operatorKind, fields.selected.length, t),
    negated: negated.has(id),
    onNegate: (on) => setNegated(id, on),
    onToggle: () => undefined,
    onClear: () => undefined,
    emptyLabel: empty,
    ...fields,
  });

  const listSubject = (
    key: "status" | "priority" | "assignee" | "dueDate",
    fields: Pick<FilterSubject, "label" | "icon" | "options">,
  ) =>
    subject(key, {
      ...fields,
      selected: filters[key] ?? [],
      onToggle: (value) => toggleFilter(key, value),
      onClear: () => updateFilter(key, null),
    });

  const dateSubject = (key: "startDate" | "dueDate") => {
    const selected = filters[key] ?? [];
    return subject(key, {
      label:
        key === "startDate"
          ? t("tasks:dateFilter.startDate")
          : t("tasks:boardFilters.subjects.dueDate"),
      icon: <CalendarDays />,
      selected,
      options: [
        ...(key === "dueDate"
          ? DUE_DATE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))
          : [{ value: "noDate", label: t("tasks:dateFilter.noDate") }]),
        ...selected
          .filter((value) => parseDateCondition(value))
          .map((value) => ({ value, label: formatDateCondition(value, t) })),
      ],
      onToggle: (value) => toggleFilter(key, value),
      onDateApply: (value) => {
        updateFilter(key, [
          ...selected.filter((item) => !parseDateCondition(item)),
          value,
        ]);
      },
      onClear: () => updateFilter(key, null),
    });
  };

  const allLabelGroups = groupLabels(options.labels);
  // "project: X" labels (from the Linear import) get their own Project filter.
  const isProjectGroup = (group: { name: string }) =>
    /^project:/i.test(group.name);
  const projectGroups = allLabelGroups.filter(isProjectGroup);
  const labelGroups = allLabelGroups.filter((group) => !isProjectGroup(group));
  const selectedGroups = (groups: typeof labelGroups) =>
    groups
      .filter((group) =>
        isLabelGroupSelected(options.labels, group, filters.labels),
      )
      .map((group) => group.id);
  const groupIdByLabel = new Map(
    labelGroups.map((group) => [labelGroupKey(group), group.id]),
  );
  const counts = {
    status: countValues(tasks, (task) => [task.status]),
    assignee: countValues(tasks, (task) => [task.userId]),
    priority: countValues(tasks, (task) => [task.priority]),
    workProject: countValues(tasks, (task) => [task.workProjectId]),
    cycle: countValues(tasks, (task) => [task.cycleId]),
    estimate: countValues(tasks, (task) => [String(task.estimate ?? "none")]),
    labels: countValues(tasks, (task) =>
      (task.labels ?? []).map((label) =>
        groupIdByLabel.get(labelGroupKey(label)),
      ),
    ),
  };

  const toggleGroup = (groups: typeof labelGroups) => (value: string) => {
    const group = groups.find((item) => item.id === value);
    if (!group) return;
    updateFilter(
      "labels",
      toggleLabelGroup(options.labels, group, filters.labels),
    );
  };
  // Clearing one subject must leave the other's selections in place.
  const clearGroups = (groups: typeof labelGroups) => {
    let next = filters.labels;
    for (const group of groups) {
      if (isLabelGroupSelected(options.labels, group, next)) {
        next = toggleLabelGroup(options.labels, group, next);
      }
    }
    updateFilter("labels", next && next.length > 0 ? next : null);
  };

  const statusAgeSubject = () => {
    const now = new Date();
    const selected = filters.statusAge ?? [];
    // Each option only counts tasks in its own status.
    const tasksByStatus = new Map<string, Task[]>();
    for (const task of tasks) {
      const group = tasksByStatus.get(task.status);
      if (group) group.push(task);
      else tasksByStatus.set(task.status, [task]);
    }
    const option = (value: string) => {
      const parsed = parseStatusAge(value);
      const column = columns.find((item) => item.id === parsed?.status);
      return {
        value,
        label: parsed
          ? t("tasks:boardFilters.statusAgeOption", {
              status: column?.name ?? parsed.status,
              count: parsed.days,
            })
          : value,
        icon: column
          ? getColumnIcon(column.id, column.isFinal, column.icon)
          : undefined,
        count: (tasksByStatus.get(parsed?.status ?? "") ?? []).filter((task) =>
          matchesStatusAge(task, value, now),
        ).length,
      };
    };
    const presets = columns.flatMap((column) =>
      STATUS_AGE_DAYS.map((days) =>
        serializeStatusAge({ status: column.id, days }),
      ),
    );
    return subject("statusAge", {
      label: t("tasks:boardFilters.subjects.statusAge"),
      icon: <Hourglass />,
      options: [
        ...presets,
        ...selected.filter((value) => !presets.includes(value)),
      ].map(option),
      selected,
      onToggle: (value) => toggleFilter("statusAge", value),
      onClear: () => updateFilter("statusAge", null),
    });
  };

  const core = [
    ...(showStatus
      ? [
          listSubject("status", {
            label: t("tasks:boardFilters.subjects.status"),
            icon: <CircleDot />,
            options: columns.map((column) => ({
              value: column.id,
              label: column.name,
              icon: getColumnIcon(column.id, column.isFinal, column.icon),
              count: counts.status[column.id],
            })),
          }),
          statusAgeSubject(),
        ]
      : []),
    listSubject("assignee", {
      label: t("tasks:boardFilters.subjects.assignee"),
      icon: <UserRound />,
      options: options.members.map((member) => ({
        value: member.userId,
        label: member.user?.name || t("common:people.unknown"),
        count: counts.assignee[member.userId],
        icon: (
          <MemberFilterAvatar
            name={member.user?.name}
            image={member.user?.image}
          />
        ),
      })),
    }),
    listSubject("priority", {
      label: t("tasks:boardFilters.subjects.priority"),
      icon: <PriorityGlyph priority="high" />,
      options: PRIORITIES.map((priority) => ({
        value: priority,
        label: getPriorityLabel(priority),
        icon: getPriorityIcon(priority),
        count: counts.priority[priority],
      })),
    }),
    subject(
      "labels",
      {
        label: t("tasks:boardFilters.subjects.labels"),
        icon: <Tag />,
        options: labelGroups.map((group) => ({
          value: group.id,
          label: group.name,
          icon: <LabelFilterDot color={group.color} />,
          count: counts.labels[group.id],
        })),
        selected: selectedGroups(labelGroups),
        onToggle: toggleGroup(labelGroups),
        onClear: () => clearGroups(labelGroups),
        emptyLabel: t("tasks:labels.empty"),
      },
      "include",
    ),
    ...((options.cycles ?? []).length > 0
      ? [
          subject("cycle", {
            label: t("tasks:boardFilters.subjects.cycle"),
            icon: <CirclePlay />,
            options: (options.cycles ?? []).map((cycle) => ({
              value: cycle.id,
              label: cycleTitle(cycle),
              icon: <CirclePlay />,
              count: counts.cycle[cycle.id],
            })),
            selected: filters.cycle ?? [],
            onToggle: (value) => toggleFilter("cycle", value),
            onClear: () => updateFilter("cycle", null),
          }),
        ]
      : []),
    ...((options.estimates ?? []).length > 0
      ? [
          subject("estimate", {
            label: t("tasks:boardFilters.subjects.estimate"),
            icon: <Hexagon />,
            options: [
              ...(options.estimates ?? []).map((option) => ({
                value: String(option.value),
                label: option.label,
                icon: <Hexagon />,
                count: counts.estimate[String(option.value)],
              })),
              {
                value: "none",
                label: t("tasks:boardFilters.subjects.noEstimate"),
                icon: <Hexagon />,
                count: counts.estimate.none,
              },
            ],
            selected: filters.estimate ?? [],
            onToggle: (value) => toggleFilter("estimate", value),
            onClear: () => updateFilter("estimate", null),
          }),
        ]
      : []),
    subject("workProject", {
      label: t("tasks:boardFilters.subjects.workProject"),
      icon: <Box />,
      options: (options.workProjects ?? []).map((project) => ({
        value: project.id,
        label: project.name,
        icon: <WorkProjectIcon icon={project.icon} color={project.color} />,
        count: counts.workProject[project.id],
      })),
      selected: filters.workProject ?? [],
      onToggle: (value) => toggleFilter("workProject", value),
      onClear: () => updateFilter("workProject", null),
    }),
    ...(projectGroups.length > 0
      ? [
          subject(
            "project",
            {
              label: t("tasks:boardFilters.subjects.project"),
              icon: <Layers />,
              options: projectGroups.map((group) => ({
                value: group.id,
                label: group.name.replace(/^project:\s*/i, ""),
                icon: <LabelFilterDot color={group.color} />,
                count: counts.labels[group.id],
              })),
              selected: selectedGroups(projectGroups),
              onToggle: toggleGroup(projectGroups),
              onClear: () => clearGroups(projectGroups),
            },
            "include",
          ),
        ]
      : []),
    dateSubject("startDate"),
    dateSubject("dueDate"),
    subject("createdAt", {
      label: t("tasks:boardFilters.subjects.created"),
      icon: <Clock />,
      selected: filters.createdAt ?? [],
      options: [
        ...new Set([
          ...OLDER_THAN_PRESETS.map(olderThanValue),
          ...(filters.createdAt ?? []),
        ]),
      ].flatMap((value) => {
        const days = parseOlderThan(value);
        return days === null
          ? []
          : [
              {
                value,
                label: t("tasks:boardFilters.olderThanDays", { count: days }),
              },
            ];
      }),
      onToggle: (value) => toggleFilter("createdAt", value),
      onClear: () => updateFilter("createdAt", null),
    }),
    subject("blocked", {
      label: t("tasks:boardFilters.subjects.blocked"),
      icon: <CircleSlash />,
      toggleOnly: true,
      section: "readiness",
      options: [
        { value: "true", label: t("tasks:boardFilters.subjects.blocked") },
      ],
      selected: filters.blocked ? ["true"] : [],
      onToggle: () =>
        updateFilter("blocked", filters.blocked ? undefined : true),
      onClear: () => updateFilter("blocked", undefined),
    }),
    subject("workable", {
      label: t("tasks:boardFilters.subjects.workable"),
      icon: <CircleCheck />,
      toggleOnly: true,
      section: "readiness",
      options: [
        {
          value: "true",
          label: t("tasks:boardFilters.subjects.workable"),
        },
      ],
      selected: filters.workable ? ["true"] : [],
      onToggle: () =>
        updateFilter("workable", filters.workable ? undefined : true),
      onClear: () => updateFilter("workable", undefined),
    }),
  ];

  const customFields = options.customFields.map((field) => {
    const Icon = customFieldIcon(field.type);
    const values =
      field.type === "dropdown"
        ? (field.options ?? [])
        : field.type === "boolean"
          ? ["true", "false"]
          : (options.usedCustomFieldValues[field.id] ?? []);
    return subject(customFieldSubjectId(field.id), {
      kind: "customField",
      label: field.name,
      icon: <Icon />,
      options: values.map((value) => ({
        value,
        label:
          field.type === "boolean"
            ? value === "true"
              ? "True"
              : "False"
            : field.type === "date"
              ? (formatCustomFieldValue("date", value, "medium")?.text ?? value)
              : value,
      })),
      selected: filters.customFields?.[field.id] ?? [],
      onToggle: (value) => controls.updateCustomFieldFilter(field.id, value),
      onClear: () => {
        const next = { ...filters.customFields };
        delete next[field.id];
        updateFilter(
          "customFields",
          Object.keys(next).length > 0 ? next : null,
        );
        setNegated(customFieldSubjectId(field.id), false);
      },
    });
  });

  return [...core, ...customFields];
}
