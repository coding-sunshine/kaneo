import { describe, expect, it } from "vite-plus/test";
import { estimateOptions } from "./scales";

const team = (over: Partial<Parameters<typeof estimateOptions>[0]> = {}) => ({
  estimateType: "fibonacci",
  estimateExtended: false,
  estimateAllowZero: false,
  ...over,
});
const values = (t: ReturnType<typeof team>) =>
  estimateOptions(t).map((option) => option.value);

describe("estimateOptions", () => {
  it("is empty when estimates are not in use", () => {
    expect(estimateOptions(team({ estimateType: "none" }))).toEqual([]);
  });
  it("follows Linear's scales", () => {
    expect(values(team({ estimateType: "exponential" }))).toEqual([
      1, 2, 4, 8, 16,
    ]);
    expect(values(team())).toEqual([1, 2, 3, 5, 8]);
    expect(values(team({ estimateType: "linear" }))).toEqual([1, 2, 3, 4, 5]);
  });
  it("extends the scale and allows zero", () => {
    expect(
      values(team({ estimateExtended: true, estimateAllowZero: true })),
    ).toEqual([0, 1, 2, 3, 5, 8, 13, 21]);
  });
  it("labels t-shirt sizes", () => {
    expect(
      estimateOptions(
        team({ estimateType: "tshirt", estimateExtended: true }),
      ).map((option) => option.label),
    ).toEqual(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]);
  });
});
