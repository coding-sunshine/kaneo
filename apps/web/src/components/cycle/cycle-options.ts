import type { Cycle } from "@/fetchers/cycle/get-cycles";
import { cycleRange, cycleState } from "@/lib/cycle/cycle-label";

/** Linear's order: current, upcoming (soonest first), then previous (newest first). */
export function orderCyclesForPicker(cycles: Cycle[], now = new Date()) {
  const rank = { current: 0, upcoming: 1, previous: 2 } as const;
  return [...cycles]
    .map((cycle) => ({ cycle, state: cycleState(cycle, now) }))
    .sort((a, b) =>
      a.state !== b.state
        ? rank[a.state] - rank[b.state]
        : a.state === "previous"
          ? b.cycle.number - a.cycle.number
          : a.cycle.number - b.cycle.number,
    );
}

export function cycleHint(
  cycle: Cycle,
  state: "current" | "upcoming" | "previous",
  labels: Record<"current" | "upcoming" | "previous", string>,
) {
  return `${cycleRange(cycle)} · ${labels[state]}`;
}
