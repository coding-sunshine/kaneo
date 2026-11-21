import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";

type TriageRowProps = {
  task: Task;
  slug: string | undefined;
  creator?: { name?: string | null; image?: string | null };
  selected: boolean;
  onOpen: () => void;
};

/** One incoming issue in Linear's two-line triage list: title and key, then creator and age. */
export function TriageRow({
  task,
  slug,
  creator,
  selected,
  onOpen,
}: TriageRowProps) {
  const name = creator?.name ?? "";
  return (
    // biome-ignore lint/a11y/useSemanticElements: row hosts nested content
    <div
      role="button"
      tabIndex={0}
      data-triage-row={task.id}
      data-selected={selected || undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget)
          onOpen();
      }}
      className={cn(
        "mx-2 flex h-[59px] cursor-pointer flex-col justify-center gap-1 rounded-lg px-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-accent",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {task.title}
        </span>
        <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
          {slug}-{task.number}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Avatar className="size-4 text-[8px]">
          <AvatarImage src={creator?.image ?? undefined} alt={name} />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="shrink-0">{formatRelativeAge(task.createdAt)}</span>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Linear's compact age: "9w ago", "3d ago", "just now". */
export function formatRelativeAge(value: string | Date, now = new Date()) {
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - new Date(value).getTime()) / 1000),
  );
  const units: Array<[string, number]> = [
    ["y", 31536000],
    ["mo", 7776000],
    ["w", 604800],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [label, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return "just now";
}
