import { describe, expect, it } from "vite-plus/test";
import { computeReviewWait } from "./compute-review-wait";
import { daysAgo, NOW, reportProject, reportTask } from "./report-fixture";

describe("computeReviewWait", () => {
  it("summarises how long issues in review have waited", () => {
    const project = reportProject({
      "in-review": [
        reportTask("r1", { statusSince: daysAgo(1) }),
        reportTask("r2", { statusSince: daysAgo(2) }),
        reportTask("r3", { statusSince: daysAgo(6) }),
      ],
      "in-progress": [reportTask("busy", { statusSince: daysAgo(30) })],
    });
    expect(computeReviewWait(project, NOW)).toEqual({
      count: 3,
      medianDays: 2,
      longestDays: 6,
    });
  });

  it("is empty when nothing waits for review", () => {
    expect(computeReviewWait(reportProject({}), NOW)).toEqual({
      count: 0,
      medianDays: 0,
      longestDays: 0,
    });
  });
});
