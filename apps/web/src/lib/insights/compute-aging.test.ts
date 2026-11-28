import { describe, expect, it } from "vite-plus/test";
import { computeAging } from "./compute-aging";
import { daysAgo, NOW, reportProject, reportTask } from "./report-fixture";

describe("computeAging", () => {
  it("lists in-progress items older than their team's median cycle time, oldest first", () => {
    const project = reportProject({
      "in-progress": [
        reportTask("fresh", { startedAt: daysAgo(2) }),
        reportTask("stale", { startedAt: daysAgo(9) }),
        reportTask("beta-old", { projectId: "beta", startedAt: daysAgo(5) }),
      ],
      "in-review": [reportTask("waiting", { startedAt: daysAgo(12) })],
      "to-do": [reportTask("not started", { createdAt: daysAgo(40) })],
      done: [
        // Alpha's median cycle time is 4 days, Beta's is 10.
        reportTask("a1", { startedAt: daysAgo(20), completedAt: daysAgo(17) }),
        reportTask("a2", { startedAt: daysAgo(20), completedAt: daysAgo(16) }),
        reportTask("a3", { startedAt: daysAgo(20), completedAt: daysAgo(15) }),
        reportTask("b1", {
          projectId: "beta",
          startedAt: daysAgo(30),
          completedAt: daysAgo(20),
        }),
      ],
    });
    const aging = computeAging(project, NOW);
    expect(
      aging.map((item) => [item.task.id, item.days, item.medianDays]),
    ).toEqual([
      ["waiting", 12, 4],
      ["stale", 9, 4],
    ]);
  });

  it("falls back to the median age of the team's in-progress items when nothing is done yet", () => {
    const project = reportProject({
      "in-progress": [
        reportTask("one", { startedAt: daysAgo(1) }),
        reportTask("three", { startedAt: daysAgo(3) }),
        reportTask("eight", { startedAt: daysAgo(8) }),
      ],
    });
    expect(computeAging(project, NOW).map((item) => item.task.id)).toEqual([
      "eight",
    ]);
  });
});
