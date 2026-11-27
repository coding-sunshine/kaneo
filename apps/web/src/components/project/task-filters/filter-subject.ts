import type { ReactNode } from "react";
import type { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";

export type TaskFilterControls = Pick<
  ReturnType<typeof useTaskFiltersWithLabelsSupport>,
  | "filters"
  | "updateFilter"
  | "toggleFilter"
  | "setNegated"
  | "updateCustomFieldFilter"
  | "clearFilters"
  | "activeFilterCount"
>;

export type FilterOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
};

export type FilterSubject = {
  id: string;
  label: string;
  icon: ReactNode;
  kind: "core" | "customField";
  operators: { positive: string; negative: string };
  options: FilterOption[];
  selected: string[];
  negated: boolean;
  onDateApply?: (value: string) => void;
  /** A free-text subject (Reviews' Content): the panel shows an input instead of options. */
  textPlaceholder?: string;
  onTextApply?: (value: string) => void;
  /** Adds a "Custom ..." row that opens a free-text input; `isValid` gates Enter. */
  custom?: {
    label: string;
    placeholder: string;
    isValid: (text: string) => boolean;
    onApply: (text: string) => void;
  };
  /** Root menu section; a new section starts a separator. */
  section?: string;
  /** Single-click boolean filter with no submenu or operator/value chip controls. */
  toggleOnly?: boolean;
  /** Overrides the "N tasks" meta shown beside an option's count. */
  formatCount?: (count: number) => string;
  onToggle: (value: string) => void;
  onNegate: (negated: boolean) => void;
  onClear: () => void;
  emptyLabel: string;
};
