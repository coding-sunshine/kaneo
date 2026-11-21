import { cn } from "@/lib/cn";

export type StatusKind =
  | "backlog"
  | "todo"
  | "started"
  | "review"
  | "done"
  | "canceled";

const TONE: Record<StatusKind, string> = {
  backlog: "text-status-backlog",
  todo: "text-status-todo",
  started: "text-status-started",
  review: "text-status-review",
  done: "text-status-done",
  canceled: "text-status-canceled",
};

// Pie wedge from 12 o'clock clockwise; fraction 0.5 = right half.
function wedge(fraction: number) {
  const a = fraction * 2 * Math.PI;
  const x = 7 + 3 * Math.sin(a);
  const y = 7 - 3 * Math.cos(a);
  return `M7 7V4A3 3 0 ${fraction > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}

export function StatusIcon({
  kind,
  className,
}: {
  kind: StatusKind;
  className?: string;
}) {
  const cls = cn("size-4 shrink-0", TONE[kind], className);
  if (kind === "done" || kind === "canceled") {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true" className={cls}>
        <circle cx="7" cy="7" r="7" fill="currentColor" />
        <path
          d={
            kind === "done"
              ? "M4 7.2l2 2 4-4.2"
              : "M4.8 4.8l4.4 4.4M9.2 4.8L4.8 9.2"
          }
          fill="none"
          stroke="var(--status-glyph)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" className={cls}>
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={kind === "backlog" ? "1.9 1.9" : undefined}
      />
      {kind === "started" && <path d={wedge(0.5)} fill="currentColor" />}
      {kind === "review" && <path d={wedge(0.75)} fill="currentColor" />}
    </svg>
  );
}
