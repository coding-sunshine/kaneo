import { describe, expect, it } from "vite-plus/test";
import { countViewFilters } from "@/lib/saved-view";
import { normalizeFilters } from "./use-task-filters-with-labels-support";

describe("normalizeFilters", () => {
  it("parses legacy filters that have no matchAny", () => {
    const parsed = normalizeFilters({
      status: ["todo"],
      customFields: { size: ["L"] },
      negated: ["status"],
    });
    expect(parsed).toMatchObject({
      status: ["todo"],
      customFields: { size: ["L"] },
      negated: ["status"],
    });
    expect(parsed.matchAny).toBeUndefined();
  });

  it("keeps matchAny only when true", () => {
    expect(normalizeFilters({ matchAny: true }).matchAny).toBe(true);
    expect(normalizeFilters({ matchAny: false }).matchAny).toBeUndefined();
    expect(normalizeFilters({ matchAny: "yes" }).matchAny).toBeUndefined();
    expect(normalizeFilters("junk").matchAny).toBeUndefined();
  });

  it("does not count matchAny as a filter in saved views", () => {
    expect(countViewFilters({ status: ["todo"], matchAny: true })).toBe(1);
  });
});
