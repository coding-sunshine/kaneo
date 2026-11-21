import { describe, expect, it } from "vite-plus/test";
import type { Cycle } from "@/fetchers/cycle/get-cycles";
import { cycleRange, cycleState } from "@/lib/cycle/cycle-label";
import { orderCyclesForPicker } from "./cycle-options";

const now = new Date("2026-11-15T12:00:00Z");
const cycle = (number: number, start: string, end: string, done = false) =>
  ({
    id: `c${number}`,
    number,
    name: null,
    startsAt: start,
    endsAt: end,
    completedAt: done ? end : null,
  }) as unknown as Cycle;

const cycles = [
  cycle(1, "2026-10-12T00:00:00Z", "2026-10-26T00:00:00Z", true),
  cycle(2, "2026-10-26T00:00:00Z", "2026-11-09T00:00:00Z", true),
  cycle(3, "2026-11-09T00:00:00Z", "2026-11-23T00:00:00Z"),
  cycle(4, "2026-11-23T00:00:00Z", "2026-12-07T00:00:00Z"),
  cycle(5, "2026-12-07T00:00:00Z", "2026-12-21T00:00:00Z"),
];

describe("cycle helpers", () => {
  it("derives state from dates", () => {
    expect(cycles.map((c) => cycleState(c, now))).toEqual([
      "previous",
      "previous",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("orders the picker current, upcoming soonest first, previous newest first", () => {
    expect(
      orderCyclesForPicker(cycles, now).map((o) => o.cycle.number),
    ).toEqual([3, 4, 5, 2, 1]);
  });

  it("shows the inclusive end day", () => {
    const local = {
      startsAt: new Date(2026, 10, 9).toISOString(),
      endsAt: new Date(2026, 10, 23).toISOString(),
    };
    expect(cycleRange(local)).toMatch(/22$/);
  });
});
