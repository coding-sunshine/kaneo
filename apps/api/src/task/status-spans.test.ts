import { describe, expect, it } from "vite-plus/test";
import { computeStatusSpans } from "./status-spans";

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes));
const MINUTE = 60_000;

describe("computeStatusSpans", () => {
  it("sums the time spent in each status, current one last", () => {
    const spans = computeStatusSpans(
      { status: "in-review", createdAt: at(0) },
      [
        { at: at(10), oldStatus: "to-do", newStatus: "in-progress" },
        { at: at(30), oldStatus: "in-progress", newStatus: "to-do" },
        { at: at(35), oldStatus: "to-do", newStatus: "in-progress" },
        { at: at(40), oldStatus: "in-progress", newStatus: "in-review" },
      ],
      at(100),
    );

    expect(spans).toEqual([
      { status: "to-do", totalMs: 15 * MINUTE, current: false },
      { status: "in-progress", totalMs: 25 * MINUTE, current: false },
      { status: "in-review", totalMs: 60 * MINUTE, current: true },
    ]);
  });

  it("gives a task without status changes one span since creation", () => {
    expect(
      computeStatusSpans({ status: "to-do", createdAt: at(0) }, [], at(5)),
    ).toEqual([{ status: "to-do", totalMs: 5 * MINUTE, current: true }]);
  });

  it("puts the open span on the task's current status after a slug rename", () => {
    const spans = computeStatusSpans(
      { status: "review", createdAt: at(0) },
      [{ at: at(10), oldStatus: "to-do", newStatus: "in-review" }],
      at(30),
    );

    expect(spans).toEqual([
      { status: "to-do", totalMs: 10 * MINUTE, current: false },
      { status: "review", totalMs: 20 * MINUTE, current: true },
    ]);
  });

  it("skips spans whose status the event does not name", () => {
    const spans = computeStatusSpans(
      { status: "done", createdAt: at(0) },
      [
        { at: at(10), oldStatus: undefined, newStatus: 7 },
        { at: at(20), oldStatus: null, newStatus: "done" },
      ],
      at(25),
    );

    expect(spans).toEqual([
      { status: "done", totalMs: 5 * MINUTE, current: true },
    ]);
  });

  it("never reports negative time for out-of-order clocks", () => {
    const spans = computeStatusSpans(
      { status: "in-progress", createdAt: at(10) },
      [{ at: at(5), oldStatus: "to-do", newStatus: "in-progress" }],
      at(20),
    );

    expect(spans).toEqual([
      { status: "to-do", totalMs: 0, current: false },
      { status: "in-progress", totalMs: 10 * MINUTE, current: true },
    ]);
  });
});
