import { describe, expect, it } from "vite-plus/test";
import { isWithinNotificationSchedule, isValidTimezone } from "./schedule";

const base = {
  scheduleEnabled: true,
  scheduleTimezone: "America/New_York",
  scheduleDays: [1, 2, 3, 4, 5],
  scheduleStart: "09:00",
  scheduleEnd: "18:00",
};

describe("isWithinNotificationSchedule", () => {
  it("always delivers when the schedule is off", () => {
    expect(
      isWithinNotificationSchedule(
        { ...base, scheduleEnabled: false },
        new Date("2025-01-04T03:00:00Z"),
      ),
    ).toBe(true);
  });

  it("uses the user's timezone for the weekday and the hour", () => {
    // Mon 2025-01-06 14:00 UTC is 09:00 in New York.
    expect(
      isWithinNotificationSchedule(base, new Date("2025-01-06T14:00:00Z")),
    ).toBe(true);
    expect(
      isWithinNotificationSchedule(base, new Date("2025-01-06T13:59:00Z")),
    ).toBe(false);
    // End is exclusive: 18:00 New York.
    expect(
      isWithinNotificationSchedule(base, new Date("2025-01-06T23:00:00Z")),
    ).toBe(false);
  });

  it("holds back days outside the schedule", () => {
    // Sat 2025-01-04 17:00 UTC is 12:00 in New York.
    expect(
      isWithinNotificationSchedule(base, new Date("2025-01-04T17:00:00Z")),
    ).toBe(false);
    // Tue 02:00 UTC is still Monday evening in New York, past the end.
    expect(
      isWithinNotificationSchedule(base, new Date("2025-01-07T02:00:00Z")),
    ).toBe(false);
  });

  it("validates timezones", () => {
    expect(isValidTimezone("Europe/Berlin")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
  });
});
