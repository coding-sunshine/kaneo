import type { BadgeStyle } from "@/components/sidebar-customize/sidebar-items";

/** How a count looks in each badge style, shown next to the choice. */
export function BadgeSample({ style }: { style: BadgeStyle }) {
  return style === "count" ? (
    <span className="text-muted-foreground text-xs tabular-nums">1</span>
  ) : (
    <span
      aria-hidden="true"
      className="size-2 rounded-full bg-muted-foreground"
    />
  );
}
