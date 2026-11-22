import { describe, expect, it } from "vite-plus/test";
import type Task from "@/types/task";
import { effortWeight, viewUsesEstimates } from "./effort-weight";

const task = (projectId: string, estimate?: number | null) =>
  ({ projectId, estimate }) as Task;

describe("effortWeight", () => {
  const teams = [
    { id: "a", estimateType: "fibonacci", estimateCountUnestimated: false },
    { id: "b", estimateType: "linear", estimateCountUnestimated: true },
    { id: "c", estimateType: "none" },
    { id: "d", estimateType: "fibonacci" },
  ];
  const weight = effortWeight(teams);

  it("uses the estimate, and drops unestimated issues when the team opts out", () => {
    expect(weight(task("a", 5))).toBe(5);
    expect(weight(task("a"))).toBe(0);
    expect(weight(task("a", 0))).toBe(0);
  });

  it("counts unestimated issues as one point by default, like Linear", () => {
    expect(weight(task("d"))).toBe(1);
    expect(weight(task("d", 0))).toBe(0);
    expect(weight(task("b"))).toBe(1);
    expect(weight(task("b", 3))).toBe(3);
  });

  it("ignores teams that do not estimate", () => {
    expect(weight(task("c", 3))).toBe(0);
    expect(weight(task("missing", 3))).toBe(0);
  });
});

describe("viewUsesEstimates", () => {
  const teams = [
    { id: "a", estimateType: "tshirt" },
    { id: "c", estimateType: "none" },
  ];
  it("is true when any team in view estimates", () => {
    expect(viewUsesEstimates(teams, ["c", "a"])).toBe(true);
    expect(viewUsesEstimates(teams, ["c"])).toBe(false);
    expect(viewUsesEstimates(teams, [])).toBe(false);
  });
});
