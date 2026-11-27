import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActiveFilterChip } from "@/components/project/task-filters/active-filter-chip";
import { FilterRootPanel } from "@/components/project/task-filters/filter-root-panel";
import type { ReviewSubjectBinder } from "@/components/reviews/use-reviews-filter-subjects";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createAdvancedId,
  type ReviewsAdvancedEntry,
  type ReviewsAdvancedFilter,
} from "@/lib/reviews-advanced";
import type { ReviewFilter, ReviewFilterId } from "@/lib/reviews-filters";

const MAX_GROUP_DEPTH = 3;

/** Renders one Advanced filter group: its conditions, nested groups, operator toggles and add controls. */
export function ReviewsAdvancedGroup({
  group,
  bindSubject,
  subjectIds,
  onChange,
  depth = 0,
  onRemove,
}: {
  group: ReviewsAdvancedFilter;
  bindSubject: ReviewSubjectBinder;
  subjectIds: readonly ReviewFilterId[];
  onChange: (next: ReviewsAdvancedFilter) => void;
  depth?: number;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{
    id: string;
    subject: ReviewFilterId;
  } | null>(null);

  const operatorLabel =
    group.operator === "and"
      ? t("workspace:reviews.filters.advanced.and")
      : t("workspace:reviews.filters.advanced.or");

  const operatorToggle = (
    <button
      type="button"
      aria-label={t("workspace:reviews.filters.advanced.toggleOperator", {
        operator: operatorLabel,
      })}
      onClick={() =>
        onChange({
          ...group,
          operator: group.operator === "and" ? "or" : "and",
        })
      }
      className="h-7 w-9 shrink-0 rounded-md text-muted-foreground text-xs outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
    >
      {operatorLabel}
    </button>
  );

  const replaceEntry = (id: string, next: ReviewsAdvancedEntry | null) => {
    const conditions = next
      ? group.conditions.map((entry) => (entry.id === id ? next : entry))
      : group.conditions.filter((entry) => entry.id !== id);
    onChange({ ...group, conditions });
  };

  const handleAddOpenChange = (open: boolean) => {
    setAdding(open);
    if (!open) setDraft(null);
  };

  const addSubjects = subjectIds.map((subjectId) => {
    const activeDraft =
      draft && draft.subject === subjectId
        ? group.conditions.find(
            (entry) => entry.kind === "condition" && entry.id === draft.id,
          )
        : undefined;
    const current: ReviewFilter =
      activeDraft && activeDraft.kind === "condition"
        ? { values: activeDraft.values, negated: activeDraft.negated }
        : { values: [], negated: false };

    return bindSubject(subjectId, current, (next) => {
      if (activeDraft && activeDraft.kind === "condition") {
        if (!next || next.values.length === 0) {
          replaceEntry(activeDraft.id, null);
          setDraft(null);
        } else {
          replaceEntry(activeDraft.id, {
            ...activeDraft,
            values: next.values,
            negated: next.negated,
          });
        }
      } else if (next && next.values.length > 0) {
        const id = createAdvancedId();
        setDraft({ id, subject: subjectId });
        onChange({
          ...group,
          conditions: [
            ...group.conditions,
            {
              kind: "condition",
              id,
              subject: subjectId,
              values: next.values,
              negated: next.negated,
            },
          ],
        });
      }
    });
  });

  const addNestedGroup = () => {
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        {
          kind: "group",
          id: createAdvancedId(),
          operator: group.operator === "and" ? "or" : "and",
          conditions: [],
        },
      ],
    });
  };

  const list = (
    <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
      {group.conditions.map((entry, index) => (
        <li
          key={entry.id}
          className={
            entry.kind === "group"
              ? "flex items-start gap-1.5"
              : "flex items-center gap-1.5"
          }
        >
          {index > 0 && operatorToggle}
          {entry.kind === "condition" ? (
            <ActiveFilterChip
              subject={bindSubject(
                entry.subject,
                { values: entry.values, negated: entry.negated },
                (next) =>
                  replaceEntry(
                    entry.id,
                    next && next.values.length > 0
                      ? {
                          ...entry,
                          values: next.values,
                          negated: next.negated,
                        }
                      : null,
                  ),
              )}
            />
          ) : (
            <ReviewsAdvancedGroup
              group={entry}
              bindSubject={bindSubject}
              subjectIds={subjectIds}
              depth={depth + 1}
              onChange={(next) =>
                replaceEntry(entry.id, {
                  ...entry,
                  operator: next.operator,
                  conditions: next.conditions,
                })
              }
              onRemove={() => replaceEntry(entry.id, null)}
            />
          )}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        {group.conditions.length > 0 && operatorToggle}
        <Popover open={adding} onOpenChange={handleAddOpenChange}>
          <PopoverTrigger
            render={<Button variant="outline" size="xs" className="h-7" />}
          >
            <Plus />
            {t("workspace:reviews.filters.advanced.addFilter")}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60">
            <FilterRootPanel
              subjects={addSubjects}
              onApplied={() => handleAddOpenChange(false)}
            />
          </PopoverContent>
        </Popover>
        {depth < MAX_GROUP_DEPTH && (
          <Button
            variant="ghost"
            size="xs"
            className="h-7 text-muted-foreground"
            onClick={addNestedGroup}
          >
            <Plus />
            {t("workspace:reviews.filters.advanced.addGroup")}
          </Button>
        )}
      </li>
    </ul>
  );

  if (depth === 0) return list;

  return (
    <div
      role="group"
      aria-label={t("workspace:reviews.filters.advanced.group")}
      className="flex flex-1 items-start gap-1.5 rounded-md border border-border/80 bg-muted/30 p-2"
    >
      {list}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("workspace:reviews.filters.advanced.removeGroup")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
