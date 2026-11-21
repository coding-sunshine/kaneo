import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

const DAYS = [
  ["day", 1],
  ["threeDays", 3],
  ["week", 7],
] as const;

/** Snooze presets resolve to 9am local on the target day, as in Linear. */
export function snoozeDate(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function SnoozeDialog({
  open,
  onOpenChange,
  onSnooze,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSnooze: (until: Date) => void;
}) {
  const { t } = useTranslation();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandDialogPopup>
        <Command items={DAYS}>
          <CommandPanel>
            <CommandList>
              {([key, days]: (typeof DAYS)[number]) => (
                <CommandItem
                  key={key}
                  value={t(`tasks:triage.snoozeFor.${key}`)}
                  onClick={() => onSnooze(snoozeDate(days))}
                >
                  {t(`tasks:triage.snoozeFor.${key}`)}
                </CommandItem>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}

export function DuplicateDialog({
  open,
  onOpenChange,
  project,
  slug,
  excludeId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithTasks | undefined;
  slug: string | undefined;
  excludeId: string | undefined;
  onPick: (original: Task) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const items = useMemo(
    () =>
      (project?.columns ?? []).flatMap((column) =>
        column.tasks
          .filter((task) => task.id !== excludeId && column.id !== "triage")
          .map((task) => ({
            task,
            icon: column.icon,
            isFinal: column.isFinal,
          })),
      ),
    [project, excludeId],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <CommandDialogPopup>
        <Command items={items}>
          <CommandInput
            placeholder={t("tasks:triage.searchIssues")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <CommandPanel>
            <CommandEmpty>
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("tasks:relations.noTasksFound")}
              </p>
            </CommandEmpty>
            <CommandList>
              {(item: (typeof items)[number]) => (
                <CommandItem
                  key={item.task.id}
                  value={`${slug}-${item.task.number} ${item.task.title}`}
                  onClick={() => onPick(item.task)}
                  className="flex items-center gap-3 py-2"
                >
                  {getColumnIcon(item.task.status, item.isFinal, item.icon)}
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {slug}-{item.task.number}
                  </span>
                  <span className="flex-1 truncate text-sm">
                    {item.task.title}
                  </span>
                </CommandItem>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
