import { describe, expect, it } from "vite-plus/test";
import { dependencyConflicts } from "./dependency-conflicts";

const project = (
  id: string,
  startDate: string | null,
  targetDate: string | null,
  dependsOnIds: string[] = [],
) => ({ id, startDate, targetDate, dependsOnIds });

describe("dependencyConflicts", () => {
  it("flags a project that starts before what it waits on ends", () => {
    const conflicts = dependencyConflicts([
      project("x", "2027-01-10T00:00:00.000Z", "2027-02-01T00:00:00.000Z", [
        "y",
      ]),
      project("y", "2027-01-01T00:00:00.000Z", "2027-01-20T00:00:00.000Z"),
    ]);
    expect(conflicts.get("x")).toEqual(["y"]);
    expect(conflicts.has("y")).toBe(false);
  });

  it("allows a project that starts when or after its dependency ends", () => {
    const conflicts = dependencyConflicts([
      project("x", "2027-01-20T00:00:00.000Z", "2027-02-01T00:00:00.000Z", [
        "y",
      ]),
      project("y", "2027-01-01T00:00:00.000Z", "2027-01-20T00:00:00.000Z"),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it("ignores missing dates and unknown projects", () => {
    const conflicts = dependencyConflicts([
      project("x", null, "2027-02-01T00:00:00.000Z", ["y", "gone"]),
      project("y", "2027-01-01T00:00:00.000Z", "2027-03-01T00:00:00.000Z"),
      project("z", "2027-01-01T00:00:00.000Z", null, ["w"]),
      project("w", "2027-01-01T00:00:00.000Z", null),
    ]);
    expect(conflicts.size).toBe(0);
  });
});
