import { describe, expect, it } from "vite-plus/test";
import { activityGroups } from "./document-activity-groups";

// Thursday 26 Nov 2026, local time. Linear's week starts on Sunday 22 Nov.
const now = new Date(2026, 10, 26, 15, 0);
const at = (day: number, month = 10) => ({
  id: `${month}-${day}`,
  updatedAt: new Date(2026, month, day, 9, 0).toISOString(),
});

describe("activityGroups", () => {
  it("puts each document in this week, last week, this month or older, newest group first", () => {
    const groups = activityGroups(
      [at(26), at(22), at(21), at(15), at(14), at(28, 9)],
      now,
    );
    expect(
      groups.map((group) => [group.key, group.documents.map((d) => d.id)]),
    ).toEqual([
      ["thisWeek", ["10-26", "10-22"]],
      ["lastWeek", ["10-21", "10-15"]],
      ["thisMonth", ["10-14"]],
      ["older", ["9-28"]],
    ]);
  });

  it("leaves out groups with nothing in them", () => {
    expect(activityGroups([at(25)], now).map((group) => group.key)).toEqual([
      "thisWeek",
    ]);
    expect(activityGroups([], now)).toEqual([]);
  });
});
