import { describe, expect, it } from "vite-plus/test";
import { computeThroughput } from "./compute-throughput";
import { daysAgo, NOW, reportProject, reportTask } from "./report-fixture";

const done = (id: string, days: number) =>
  reportTask(id, { status: "done", completedAt: daysAgo(days) });

describe("computeThroughput", () => {
  it("counts completed issues per Monday week, with empty weeks and a four-week rolling median", () => {
    // NOW is Wednesday 2027-03-17; this week starts Monday 2027-03-15.
    const project = reportProject({
      done: [
        done("this-week", 1),
        done("last-week-1", 3),
        done("last-week-2", 4),
        done("three-weeks-ago", 17),
        done("three-weeks-ago-2", 18),
        done("three-weeks-ago-3", 19),
      ],
      "in-progress": [reportTask("open", { startedAt: daysAgo(3) })],
    });
    const weeks = computeThroughput(project, 5, NOW);
    expect(weeks.map((week) => week.key)).toEqual([
      "2027-02-15",
      "2027-02-22",
      "2027-03-01",
      "2027-03-08",
      "2027-03-15",
    ]);
    expect(weeks.map((week) => week.count)).toEqual([0, 3, 0, 2, 1]);
    // Median of the week and the three before it, including weeks before
    // the charted range: 02-15's window is all empty weeks.
    expect(weeks.map((week) => week.rollingMedian)).toEqual([0, 0, 0, 1, 1.5]);
  });

  it("carries no per-person field", () => {
    const [week] = computeThroughput(reportProject({}), 1, NOW);
    expect(Object.keys(week).sort()).toEqual(
      ["count", "key", "rollingMedian", "start"].sort(),
    );
  });
});
