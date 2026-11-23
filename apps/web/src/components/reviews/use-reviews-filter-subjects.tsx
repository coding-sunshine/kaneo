import {
  CircleDot,
  CirclePlay,
  Flag,
  GitMerge,
  Package,
  Ruler,
  Tag,
  ThumbsUp,
  TriangleAlert,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/components/project/task-filters/filter-subject";
import { LabelFilterDot } from "@/components/project/task-filters/label-filter-dot";
import { MemberFilterAvatar } from "@/components/project/task-filters/member-filter-avatar";
import { operatorLabels } from "@/components/project/task-filters/operator-labels";
import {
  APPROVAL_COUNTS,
  CHECK_STATES,
  clearFilter,
  countMatches,
  DATE_PRESETS,
  type FilterContext,
  ME,
  MERGE_STATUSES,
  REVIEW_FILTER_IDS,
  type ReviewFilterId,
  type ReviewsFilters,
  setFilterNegated,
  toggleFilterValue,
} from "@/lib/reviews-filters";
import {
  PRIORITY_ORDER,
  SIZE_BUCKETS,
  type ReviewItem,
} from "@/lib/reviews-view";
import { REVIEW_STATUSES } from "@/lib/reviews-status";

type Option = {
  value: string;
  label: string;
  icon?: FilterSubject["options"][number]["icon"];
};

const unique = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

/** The Reviews filter menu's entries, in the shape the shared filter menu and chips read. */
export function useReviewsFilterSubjects(
  items: ReviewItem[],
  filters: ReviewsFilters,
  onChange: (filters: ReviewsFilters) => void,
  ctx: FilterContext,
): FilterSubject[] {
  const { t } = useTranslation();
  const person = (login: string): Option => ({
    value: login,
    label: login,
    icon: <MemberFilterAvatar name={login} />,
  });
  const people = (logins: string[]): Option[] => [
    ...(ctx.me
      ? [{ ...person(ME), label: t("workspace:reviews.filters.me") }]
      : []),
    ...unique(logins)
      .filter((login) => login !== ctx.me)
      .map(person),
  ];
  const names = (values: string[]): Option[] =>
    unique(values.filter(Boolean)).map((value) => ({ value, label: value }));
  const fixed = (values: readonly string[], key: string): Option[] =>
    values.map((value) => ({
      value,
      label: t(`workspace:reviews.${key}.${value}`),
    }));
  const issues = items.flatMap((pr) => (pr.issue ? [pr.issue] : []));

  const definitions: Record<
    ReviewFilterId,
    {
      icon: FilterSubject["icon"];
      section: string;
      options: Option[];
      empty?: string;
    }
  > = {
    status: {
      icon: <CircleDot />,
      section: "state",
      options: fixed(REVIEW_STATUSES, "status"),
    },
    mergeStatus: {
      icon: <GitMerge />,
      section: "state",
      options: fixed(MERGE_STATUSES, "filters.merge"),
    },
    checks: {
      icon: <CirclePlay />,
      section: "state",
      options: fixed(CHECK_STATES, "filters.checks"),
    },
    hasConflicts: {
      icon: <TriangleAlert />,
      section: "state",
      options: [{ value: "true", label: t("workspace:reviews.filters.yes") }],
    },
    size: {
      icon: <Ruler />,
      section: "state",
      options: fixed(SIZE_BUCKETS, "size"),
    },
    author: {
      icon: <UserRound />,
      section: "people",
      options: people(
        items.flatMap((pr) => (pr.author ? [pr.author.login] : [])),
      ),
    },
    reviewers: {
      icon: <Users />,
      section: "people",
      options: people(items.flatMap((pr) => pr.reviewers.map((r) => r.login))),
    },
    teamReviewers: {
      icon: <Users />,
      section: "people",
      options: names(items.flatMap((pr) => pr.teamReviewers)),
    },
    approvedBy: {
      icon: <UserCheck />,
      section: "people",
      options: people(items.flatMap((pr) => pr.approvedBy)),
      empty: t("workspace:reviews.filters.noPeople"),
    },
    changesRequestedBy: {
      icon: <UserCheck />,
      section: "people",
      options: people(items.flatMap((pr) => pr.changesRequestedBy)),
      empty: t("workspace:reviews.filters.noPeople"),
    },
    approvals: {
      icon: <ThumbsUp />,
      section: "people",
      options: fixed(APPROVAL_COUNTS, "filters.approvals"),
    },
    project: {
      icon: <Package />,
      section: "issue",
      options: names(
        issues.flatMap((i) => (i.project ? [i.project.name] : [])),
      ),
    },
    team: {
      icon: <Users />,
      section: "issue",
      options: names(issues.map((i) => i.team.name)),
    },
    priority: {
      icon: <Flag />,
      section: "issue",
      options: ["no-priority", ...PRIORITY_ORDER.slice(0, -1)].map((value) => ({
        value,
        label: t(`tasks:priority.${value}`),
      })),
    },
    missingIssue: {
      icon: <Flag />,
      section: "issue",
      options: [{ value: "true", label: t("workspace:reviews.filters.yes") }],
    },
    repoOwner: {
      icon: <Package />,
      section: "repo",
      options: names(items.map((pr) => pr.owner)),
    },
    repoName: {
      icon: <Package />,
      section: "repo",
      options: names(items.map((pr) => pr.repo)),
    },
    labels: {
      icon: <Tag />,
      section: "repo",
      options: [
        ...new Map(
          items.flatMap((pr) => pr.labels).map((l) => [l.name, l]),
        ).values(),
      ]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((label) => ({
          value: label.name,
          label: label.name,
          icon: <LabelFilterDot color={`#${label.color}`} />,
        })),
      empty: t("workspace:reviews.filters.noLabels"),
    },
    content: { icon: <Tag />, section: "repo", options: [] },
    opened: {
      icon: <CircleDot />,
      section: "dates",
      options: fixed(DATE_PRESETS, "filters.date"),
    },
    updated: {
      icon: <CircleDot />,
      section: "dates",
      options: fixed(DATE_PRESETS, "filters.date"),
    },
    merged: {
      icon: <GitMerge />,
      section: "dates",
      options: fixed(DATE_PRESETS, "filters.date"),
    },
    closed: {
      icon: <CircleDot />,
      section: "dates",
      options: fixed(DATE_PRESETS, "filters.date"),
    },
  };

  return REVIEW_FILTER_IDS.map((id): FilterSubject => {
    const { icon, section, options, empty = "" } = definitions[id];
    const selected = filters[id]?.values ?? [];
    // Selected values stay listed so they can be unticked after the data changes.
    const listed = [
      ...options,
      ...selected
        .filter((value) => !options.some((option) => option.value === value))
        .map((value) => ({ value, label: value })),
    ];
    return {
      id,
      kind: "core",
      label: t(`workspace:reviews.filters.subject.${id}`),
      icon,
      section,
      operators: operatorLabels("is", selected.length, t),
      options:
        id === "content"
          ? []
          : listed.map((option) => ({
              ...option,
              count: countMatches(items, id, option.value, ctx),
            })),
      selected,
      negated: filters[id]?.negated ?? false,
      formatCount: (count) => t("workspace:reviews.filters.count", { count }),
      ...(id === "content" && {
        textPlaceholder: t("workspace:reviews.filters.contentPlaceholder"),
        onTextApply: (value: string) =>
          onChange({
            ...filters,
            content: { values: [value], negated: false },
          }),
      }),
      onToggle: (value) => onChange(toggleFilterValue(filters, id, value)),
      onNegate: (negated) => onChange(setFilterNegated(filters, id, negated)),
      onClear: () => onChange(clearFilter(filters, id)),
      emptyLabel: empty,
    };
  });
}
