import { DateFilterEditor } from "./date-filter-editor";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseDateCondition } from "@/lib/task-filters/date-condition";
import { subjectFilterEntries } from "./filter-entries";
import { FilterListbox } from "./filter-listbox";
import { FilterTextInput } from "./filter-text-input";
import type { FilterSubject } from "./filter-subject";

type FilterSubjectPanelProps = {
  subject: FilterSubject;
  onApplied?: () => void;
  onBack?: () => void;
};

export function FilterSubjectPanel({
  subject,
  onBack,
  onApplied,
}: FilterSubjectPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  if (subject.onTextApply) {
    return (
      <FilterTextInput
        placeholder={subject.textPlaceholder ?? subject.label}
        initial={subject.selected[0]}
        onApply={(value) => {
          subject.onTextApply?.(value);
          onApplied?.();
        }}
      />
    );
  }

  if (subject.custom && customOpen) {
    const { custom } = subject;
    return (
      <FilterTextInput
        placeholder={custom.placeholder}
        isValid={custom.isValid}
        onApply={(value) => {
          custom.onApply(value);
          onApplied?.();
        }}
      />
    );
  }

  return (
    <div className="-mx-1 -my-0.5">
      <FilterListbox
        placeholder={t("tasks:filterMenu.searchSubject", {
          name: subject.label,
        })}
        groups={subjectFilterEntries(
          subject,
          query,
          subject.formatCount ??
            ((count) => t("tasks:toolbar.taskCount", { count })),
        )}
        query={query}
        onQueryChange={setQuery}
        emptyLabel={
          subject.options.length === 0
            ? subject.emptyLabel
            : t("tasks:filterMenu.noResults")
        }
        onEntrySelect={(entry) => entry.toggle?.()}
        onInputKeyDown={(event) => {
          if (
            onBack &&
            query === "" &&
            (event.key === "ArrowLeft" || event.key === "Backspace")
          ) {
            event.preventDefault();
            onBack();
          }
        }}
      />
      {subject.custom && (
        <button
          type="button"
          className="w-full border-t px-3 py-2 text-left text-sm hover:bg-accent"
          onClick={() => setCustomOpen(true)}
        >
          {subject.custom.label}
        </button>
      )}
      {subject.onDateApply && (
        <DateFilterEditor
          key={subject.selected.find((value) => parseDateCondition(value))}
          selected={subject.selected}
          onApply={(value) => {
            subject.onDateApply?.(value);
            onApplied?.();
          }}
        />
      )}
    </div>
  );
}
