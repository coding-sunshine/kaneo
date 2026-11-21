import { describe, expect, it } from "vite-plus/test";
import { groupProjectBy } from "@/lib/group-project";

describe("group by cycle", () => {
  it("is an available grouping", async () => {
    const { GROUP_BY_OPTIONS } = await import("@/lib/group-project");
    expect(GROUP_BY_OPTIONS).toContain("cycle");
    expect(typeof groupProjectBy).toBe("function");
  });
});
