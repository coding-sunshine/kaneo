import { Ban, CheckCheck, Clock, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LabelChips } from "@/components/task-chips/label-chips";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { getPriorityIcon } from "@/lib/priority";
import type Task from "@/types/task";

type TriageRowProps = {
  task: Task;
  slug: string | undefined;
  workspaceId: string;
  selected: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onDuplicate: () => void;
  onDecline: () => void;
  onSnooze: () => void;
};

/** One incoming issue in the team Triage inbox, with Linear's four actions. */
export function TriageRow({
  task,
  slug,
  workspaceId,
  selected,
  onOpen,
  onAccept,
  onDuplicate,
  onDecline,
  onSnooze,
}: TriageRowProps) {
  const { t } = useTranslation();
  const actions = [
    ["1", CheckCheck, "triage.accept", onAccept],
    ["2", Copy, "triage.duplicate", onDuplicate],
    ["3", Ban, "triage.decline", onDecline],
    ["H", Clock, "triage.snooze", onSnooze],
  ] as const;

  return (
    // biome-ignore lint/a11y/useSemanticElements: row hosts nested buttons
    <div
      role="button"
      tabIndex={0}
      data-selected={selected || undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget)
          onOpen();
      }}
      className={cn(
        "group flex h-10 cursor-pointer items-center gap-2.5 border-border/50 border-b px-5 outline-none transition-colors hover:bg-accent/50",
        selected && "bg-accent/60",
      )}
    >
      <span className="flex w-4 shrink-0 justify-center [&_svg]:size-3.5">
        {getPriorityIcon(task.priority ?? "")}
      </span>
      <span className="w-16 shrink-0 truncate font-medium text-muted-foreground text-xs">
        {slug}-{task.number}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {task.title}
      </span>
      <span className="hidden shrink-0 lg:flex">
        <LabelChips task={task} workspaceId={workspaceId} max={2} />
      </span>
      <span className="w-12 shrink-0 text-right text-muted-foreground text-xs tabular-nums group-hover:hidden group-data-selected:hidden">
        {formatDateShort(task.createdAt)}
      </span>
      <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex group-data-selected:flex">
        {actions.map(([key, Icon, label, run]) => (
          <button
            key={key}
            type="button"
            title={`${t(`tasks:${label}`)} (${key})`}
            aria-label={t(`tasks:${label}`)}
            onClick={(event) => {
              event.stopPropagation();
              run();
            }}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </span>
    </div>
  );
}
