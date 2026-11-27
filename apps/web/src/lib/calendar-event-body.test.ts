import { describe, expect, it } from "vite-plus/test";
import { toCalendarEventBody } from "./calendar-event-body";

const base = {
  provider: "google" as const,
  title: "  Sprint kickoff ",
  date: "2026-12-01",
  startTime: "09:30",
  endTime: "10:00",
  allDay: false,
  addMeeting: true,
  meetingUrl: "",
};

describe("toCalendarEventBody", () => {
  it("turns local times into instants", () => {
    expect(toCalendarEventBody(base)).toEqual({
      provider: "google",
      title: "Sprint kickoff",
      allDay: false,
      start: new Date(2026, 11, 1, 9, 30).toISOString(),
      end: new Date(2026, 11, 1, 10, 0).toISOString(),
      addMeeting: true,
    });
  });

  it("sends dates for an all-day event and keeps a pasted link", () => {
    expect(
      toCalendarEventBody({
        ...base,
        allDay: true,
        addMeeting: false,
        meetingUrl: " https://meet.example.com/room ",
      }),
    ).toEqual({
      provider: "google",
      title: "Sprint kickoff",
      allDay: true,
      start: "2026-12-01",
      end: "2026-12-01",
      addMeeting: false,
      meetingUrl: "https://meet.example.com/room",
    });
  });

  it("returns null when the event would end before it starts", () => {
    expect(toCalendarEventBody({ ...base, endTime: "09:00" })).toBeNull();
    expect(toCalendarEventBody({ ...base, title: " " })).toBeNull();
  });
});
