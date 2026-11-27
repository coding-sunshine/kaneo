import { describe, expect, it } from "vite-plus/test";
import { groupEventsByDay } from "./external-events-by-day";

const event = (over: Record<string, unknown>) => ({
  id: "e1",
  provider: "google" as const,
  title: "Design review",
  start: "2026-11-10",
  end: "2026-11-10",
  allDay: true,
  meetingUrl: null,
  url: null,
  ...over,
});

describe("groupEventsByDay", () => {
  it("places an all-day event on every day it covers", () => {
    const days = groupEventsByDay([
      event({ start: "2026-11-12", end: "2026-11-14" }),
    ]);
    expect([...days.keys()]).toEqual([
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
    ]);
  });

  it("places a timed event on its local day and not the next one at midnight", () => {
    const start = new Date(2026, 10, 20, 22, 0);
    const end = new Date(2026, 10, 21, 0, 0);
    const days = groupEventsByDay([
      event({
        allDay: false,
        start: start.toISOString(),
        end: end.toISOString(),
      }),
    ]);
    expect([...days.keys()]).toEqual(["2026-11-20"]);
  });

  it("orders all-day events before timed ones on a day", () => {
    const days = groupEventsByDay([
      event({
        id: "timed",
        allDay: false,
        start: new Date(2026, 10, 10, 9).toISOString(),
        end: new Date(2026, 10, 10, 10).toISOString(),
      }),
      event({ id: "all-day" }),
    ]);
    expect(days.get("2026-11-10")?.map((item) => item.id)).toEqual([
      "all-day",
      "timed",
    ]);
  });
});
