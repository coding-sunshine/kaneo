import { describe, expect, it } from "vite-plus/test";
import { getSnoozeOptions, isSnoozed, parseSnooze } from "./snooze";

const now = new Date(2026, 10, 21, 18, 36); // Sat 21 Nov 2026 18:36

describe("snooze", () => {
  it("matches Linear's preset options", () => {
    const options = getSnoozeOptions(now);
    expect(options.map((o) => o.label)).toEqual([
      "An hour from now",
      "In 3 hours",
      "Tomorrow",
      "Next week",
      "A month from now",
    ]);
    expect(options[2].date).toEqual(new Date(2026, 10, 22, 9));
    expect(options[3].date).toEqual(new Date(2026, 10, 23, 9));
    expect(options[4].date).toEqual(new Date(2026, 11, 21, 9));
  });

  it("parses custom text", () => {
    expect(parseSnooze("4 pm", now)).toEqual(new Date(2026, 10, 22, 16));
    expect(parseSnooze("2 days", now)).toEqual(new Date(2026, 10, 23, 18, 36));
    expect(parseSnooze("in 5 weeks", now)).toEqual(
      new Date(2026, 11, 26, 18, 36),
    );
    expect(parseSnooze("soon", now)).toBeNull();
  });

  it("detects active snoozes", () => {
    expect(isSnoozed({ snoozedUntil: "2026-11-22T00:00:00Z" }, now)).toBe(true);
    expect(isSnoozed({ snoozedUntil: "2026-11-01T00:00:00Z" }, now)).toBe(
      false,
    );
    expect(isSnoozed({ snoozedUntil: null }, now)).toBe(false);
  });
});
