import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { type FilterEntry, matches, rootFilterEntries } from "./filter-entries";
import { FilterListbox } from "./filter-listbox";
import type { FilterSubject } from "./filter-subject";
import { FilterSubjectPanel } from "./filter-subject-panel";

const HOVER_DELAY_MS = 120;

export function FilterRootPanel({
  subjects,
  onApplied,
  actions = [],
}: {
  subjects: FilterSubject[];
  onApplied?: () => void;
  /** Entries listed above the subjects that act at once, like Linear's "Advanced filter". */
  actions?: FilterEntry[];
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [nested, setNested] = useState<{
    subjectId: string;
    anchor: HTMLElement;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const nestedSubject = subjects.find(
    (subject) => subject.id === nested?.subjectId,
  );

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const openNested = (entry: FilterEntry, anchor: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    setNested(
      entry.opensSubject ? { subjectId: entry.opensSubject, anchor } : null,
    );
  };

  const closeNested = () => {
    setNested(null);
    inputRef.current?.focus();
  };

  const shownActions = actions
    .filter((action) => matches(action.label, query))
    .map((action) => ({
      ...action,
      toggle: () => {
        action.toggle?.();
        onApplied?.();
      },
    }));

  return (
    <div className="-mx-1 -my-0.5">
      <FilterListbox
        placeholder={t("tasks:filterMenu.addFilter")}
        groups={[
          ...(shownActions.length > 0
            ? [{ value: "actions", items: shownActions }]
            : []),
          ...rootFilterEntries(subjects, query, t("tasks:common.customFields")),
        ]}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          setNested(null);
        }}
        emptyLabel={t("tasks:filterMenu.noResults")}
        activeValue={nested ? `subject:${nested.subjectId}` : null}
        inputRef={inputRef}
        onEntrySelect={(entry, element) => {
          if (entry.opensSubject) {
            openNested(entry, element);
          } else {
            entry.toggle?.();
            if (entry.closeOnSelect) onApplied?.();
          }
        }}
        onEntryHover={(entry, element) => {
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(
            () => openNested(entry, element),
            HOVER_DELAY_MS,
          );
        }}
        onInputKeyDown={(event, highlighted) => {
          if (event.key === "ArrowRight" && highlighted?.entry.opensSubject) {
            event.preventDefault();
            openNested(highlighted.entry, highlighted.element);
          }
        }}
      />
      <Popover
        open={!!nestedSubject}
        onOpenChange={(open) => {
          if (!open) closeNested();
        }}
      >
        <PopoverContent
          anchor={nested?.anchor}
          side="left"
          align="start"
          sideOffset={6}
          alignOffset={-5}
          finalFocus={inputRef}
          positionerClassName="transition-none"
          className={nestedSubject?.onDateApply ? "w-80" : "w-64"}
        >
          {nestedSubject && (
            <FilterSubjectPanel
              key={nestedSubject.id}
              subject={nestedSubject}
              onBack={closeNested}
              onApplied={() => {
                window.clearTimeout(hoverTimer.current);
                setNested(null);
                onApplied?.();
              }}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
