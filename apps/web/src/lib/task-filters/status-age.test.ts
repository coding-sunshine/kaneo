import { describe, expect, it } from "vite-plus/test";
import type Task from "@/types/task";
import {
  matchesStatusAge,
  parseStatusAge,
  serializeStatusAge,
} from "./status-age";

const DAY = 86_400_000;
const now = new Date("2026-11-20T12:00:00.000Z");

const task = (status: string, daysInStatus: number | null) =>
  ({
    status,
    statusSince:
      daysInStatus === null
        ? null
        : new Date(now.getTime() - daysInStatus * DAY).toISOString(),
  }) as Task;

describe("status age filter values", () => {
  it("round-trips a status and a day count", () => {
    expect(serializeStatusAge({ status: "in-review", days: 7 })).toBe(
      "in-review:7",
    );
    expect(parseStatusAge("in-review:7")).toEqual({
      status: "in-review",
      days: 7,
    });
  });

  it.each(["in-review", "in-review:", ":7", "in-review:-1", "in-review:x"])(
    "rejects %s",
    (value) => expect(parseStatusAge(value)).toBeNull(),
  );

  it("matches tasks in the status for more than the given days", () => {
    expect(matchesStatusAge(task("in-review", 8), "in-review:7", now)).toBe(
      true,
    );
    expect(matchesStatusAge(task("in-review", 6), "in-review:7", now)).toBe(
      false,
    );
    expect(matchesStatusAge(task("to-do", 30), "in-review:7", now)).toBe(false);
  });

  it("never matches a task without a known status start", () => {
    expect(matchesStatusAge(task("in-review", null), "in-review:7", now)).toBe(
      false,
    );
  });
});
