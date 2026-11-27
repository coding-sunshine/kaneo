import { describe, expect, it } from "vite-plus/test";
import { visibleProfile } from "./visible-profile";

const now = new Date("2026-12-04T12:00:00.000Z");
const before = new Date("2026-12-04T11:59:59.000Z");
const after = new Date("2026-12-04T12:00:01.000Z");

describe("visibleProfile", () => {
  it("reads a missing profile as all empty", () => {
    expect(visibleProfile(null, now)).toEqual({
      jobTitle: null,
      department: null,
      location: null,
      timeZone: null,
      status: null,
      outOfOffice: null,
    });
  });

  it("shows a status until it clears, and one without an end for good", () => {
    expect(
      visibleProfile({ statusText: "In a meeting", statusClearsAt: after }, now)
        .status,
    ).toEqual({ text: "In a meeting", clearsAt: after.toISOString() });
    expect(
      visibleProfile(
        { statusText: "In a meeting", statusClearsAt: before },
        now,
      ).status,
    ).toBeNull();
    expect(
      visibleProfile({ statusText: "Focusing", statusClearsAt: null }, now)
        .status,
    ).toEqual({ text: "Focusing", clearsAt: null });
  });

  it("shows an out-of-office range that has not ended, even before it starts", () => {
    const upcoming = {
      outOfOfficeFrom: new Date("2026-12-07T00:00:00.000Z"),
      outOfOfficeUntil: new Date("2026-12-11T23:59:59.000Z"),
    };
    expect(visibleProfile(upcoming, now).outOfOffice).toEqual({
      from: upcoming.outOfOfficeFrom.toISOString(),
      until: upcoming.outOfOfficeUntil.toISOString(),
    });
    expect(
      visibleProfile(
        { outOfOfficeFrom: new Date("2026-12-01"), outOfOfficeUntil: before },
        now,
      ).outOfOffice,
    ).toBeNull();
  });
});
