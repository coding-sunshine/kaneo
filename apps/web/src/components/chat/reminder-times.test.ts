import { describe, expect, it } from "vite-plus/test";
import { reminderTimes } from "./reminder-times";

describe("reminderTimes", () => {
  it("gives an hour from now, tomorrow at 9:00 and next Monday at 9:00", () => {
    // A Wednesday evening, local time.
    const now = new Date(2026, 0, 7, 21, 30);
    expect(reminderTimes(now)).toEqual({
      inOneHour: new Date(2026, 0, 7, 22, 30),
      tomorrow: new Date(2026, 0, 8, 9),
      nextWeek: new Date(2026, 0, 12, 9),
    });
  });

  it("counts a full week from a Monday, and crosses month ends", () => {
    expect(reminderTimes(new Date(2026, 0, 5, 8)).nextWeek).toEqual(
      new Date(2026, 0, 12, 9),
    );
    expect(reminderTimes(new Date(2026, 0, 31, 12)).tomorrow).toEqual(
      new Date(2026, 1, 1, 9),
    );
  });
});
