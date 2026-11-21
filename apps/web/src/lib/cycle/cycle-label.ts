import type { Cycle } from "@/fetchers/cycle/get-cycles";

type Dates = Pick<Cycle, "startsAt" | "endsAt" | "completedAt">;
export type CycleState = "current" | "upcoming" | "previous";

export function cycleState(cycle: Dates, now = new Date()): CycleState {
  if (new Date(cycle.startsAt) > now) return "upcoming";
  if (cycle.completedAt || new Date(cycle.endsAt) <= now) return "previous";
  return "current";
}

export function cycleTitle(cycle: Pick<Cycle, "number" | "name">) {
  return cycle.name ? `${cycle.name}` : `Cycle ${cycle.number}`;
}

const fmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/** Linear shows the inclusive end day: a cycle ending Mon 00:00 shows Sun. */
export function cycleRange(cycle: Dates) {
  const end = new Date(new Date(cycle.endsAt).getTime() - 1);
  return `${fmt.format(new Date(cycle.startsAt))} - ${fmt.format(end)}`;
}

export function cycleDay(date: string) {
  return {
    month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(
      new Date(date),
    ),
    day: new Date(date).getDate(),
  };
}

export function cycleCurrent(cycles: Cycle[] | undefined, now = new Date()) {
  return cycles?.find((c) => cycleState(c, now) === "current");
}
