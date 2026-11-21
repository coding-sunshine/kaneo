import { cn } from "@/lib/cn";

const BARS = [
  { x: 1.5, y: 8.5, h: 4 },
  { x: 5.5, y: 5.5, h: 7 },
  { x: 9.5, y: 2.5, h: 10 },
];

const LEVELS: Record<string, { filled: number; tone: string }> = {
  low: { filled: 1, tone: "fill-priority-bar" },
  medium: { filled: 2, tone: "fill-priority-bar" },
  high: { filled: 3, tone: "fill-priority-bar" },
};

type PriorityMarksProps = {
  priority: string | null | undefined;
  className?: string;
};

// Linear-style priority: three ascending bars, an orange square for urgent
// and three dashes for none.
export function PriorityMarks({ priority, className }: PriorityMarksProps) {
  const svgClass = cn("size-3.5 shrink-0", className);

  if (priority === "urgent") {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true" className={svgClass}>
        <rect
          x="1"
          y="1"
          width="12"
          height="12"
          rx="3"
          className="fill-priority-urgent"
        />
        <path
          d="M7 3.8v3.6"
          stroke="var(--status-glyph)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="7" cy="10" r="0.9" fill="var(--status-glyph)" />
      </svg>
    );
  }

  const { filled, tone } = LEVELS[priority ?? ""] ?? { filled: 0, tone: "" };
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" className={svgClass}>
      {BARS.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={filled === 0 ? 6.5 : bar.y}
          width="3"
          height={filled === 0 ? 1.4 : bar.h}
          rx="1"
          className={
            filled === 0 || index >= filled ? "fill-priority-bar-empty" : tone
          }
        />
      ))}
    </svg>
  );
}
