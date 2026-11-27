import { describe, expect, it } from "vite-plus/test";
import { activityGroups } from "./document-activity-groups";

// Thursday 26 Nov 2026, local time. The week starts on Monday 23 Nov.
const now = new Date(2026, 10, 26, 15, 0);
const at = (day: number, month = 10) => ({
  id: `${month}-${day}`,
  updatedAt: new Date(2026, month, day, 9, 0).toISOString(),
});

describe("activityGroups", () => {
  it("puts each document in this week, last week, this month or older, newest group first", () => {
    const groups = activityGroups(
      [at(26), at(23), at(22), at(16), at(15), at(28, 9)],
      now,
    );
    expect(
      groups.map((group) => [group.key, group.documents.map((d) => d.id)]),
    ).toEqual([
      ["thisWeek", ["10-26", "10-23"]],
      ["lastWeek", ["10-22", "10-16"]],
      ["thisMonth", ["10-15"]],
      ["older", ["9-28"]],
    ]);
  });

  it("counts a Sunday as the end of the week that began on Monday", () => {
    const sunday = new Date(2026, 10, 29, 20, 0);
    expect(
      activityGroups([at(23), at(22)], sunday).map((group) => group.key),
    ).toEqual(["thisWeek", "lastWeek"]);
  });

  it("leaves out groups with nothing in them", () => {
    expect(activityGroups([at(25)], now).map((group) => group.key)).toEqual([
      "thisWeek",
    ]);
    expect(activityGroups([], now)).toEqual([]);
  });
});
