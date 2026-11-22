import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MatchModeMenu } from "./match-mode-menu";
import { ActiveFilterChip } from "./active-filter-chip";
import { AddFilterButton } from "./add-filter-button";
import type { FilterSubject } from "./filter-subject";

type ActiveFiltersBarProps = {
  subjects: FilterSubject[];
  onClear: () => void;
  /** Opens the save-as-view dialog; the button is hidden without it. */
  onSaveView?: () => void;
  /** Linear's match all/any toggle; shown once two filters are active. */
  matchAny?: boolean;
  onMatchAnyChange?: (matchAny: boolean) => void;
  customFieldValues?: {
    hasData: boolean;
    isLoading: boolean;
    isError: boolean;
    retry: () => unknown;
  };
};

export function ActiveFiltersBar({
  subjects,
  onClear,
  onSaveView,
  matchAny = false,
  onMatchAnyChange,
  customFieldValues,
}: ActiveFiltersBarProps) {
  const { t } = useTranslation();
  const active = subjects.filter((subject) => subject.selected.length > 0);
  if (active.length === 0) return null;

  return (
    <section
      aria-label={t("tasks:filterBar.label")}
      className="flex shrink-0 items-start gap-2 border-border/80 border-b px-2 py-2 sm:px-3"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {onMatchAnyChange && active.length > 1 && (
          <MatchModeMenu matchAny={matchAny} onChange={onMatchAnyChange} />
        )}
        {active.map((subject) => (
          <ActiveFilterChip key={subject.id} subject={subject} />
        ))}
        <AddFilterButton subjects={subjects} />
        {customFieldValues?.isLoading && (
          <p role="status" className="w-full text-sm text-muted-foreground">
            {t("tasks:filterBar.customFieldsLoading")}
          </p>
        )}
        {customFieldValues?.isError && (
          <p role="alert" className="w-full text-sm text-destructive">
            {customFieldValues.hasData
              ? t("tasks:filterBar.customFieldsRefreshError")
              : t("tasks:filterBar.customFieldsUnavailable")}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void customFieldValues.retry()}
            >
              {t("common:error.tryAgain")}
            </button>
          </p>
        )}
      </div>
      {onSaveView && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onSaveView}
          className="h-7 shrink-0"
        >
          {t("navigation:views.saveAsView")}
        </Button>
      )}
      <Button
        variant="ghost"
        size="xs"
        onClick={onClear}
        className="h-7 shrink-0"
      >
        {t("common:actions.clearAll")}
      </Button>
    </section>
  );
}
