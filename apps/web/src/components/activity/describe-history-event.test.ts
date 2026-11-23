import { describe, expect, it } from "vite-plus/test";
import { describeHistoryEvent } from "./describe-history-event";

const templates: Record<string, string> = {
  "activity:cycleChanged": "moved from {{from}} to {{to}}",
  "activity:cycleAdded": "added to {{to}}",
  "activity:addedLabel": "added label {{names}}",
  "activity:removedLabel": "removed label {{names}}",
  "activity:addedToProject": "added to project {{to}}",
  "activity:setParent": "set parent issue {{to}}",
  "activity:markedDuplicate": "marked this as a duplicate of {{to}}",
};
const t = (key: string, options: Record<string, unknown> = {}) =>
  (templates[key] ?? key).replace(/{{(\w+)}}/g, (_, name) =>
    String(options[name]),
  );

describe("describeHistoryEvent", () => {
  it("words cycle moves and additions", () => {
    expect(
      describeHistoryEvent("cycle_changed", { fromCycle: 8, toCycle: 9 }, t),
    ).toBe("moved from Cycle 8 to Cycle 9");
    expect(
      describeHistoryEvent("cycle_changed", { fromCycle: null, toCycle: 6 }, t),
    ).toBe("added to Cycle 6");
  });

  it("joins label additions and removals", () => {
    expect(
      describeHistoryEvent(
        "labels_changed",
        { addedLabels: ["infra"], removedLabels: ["Feature", "Bug"] },
        t,
      ),
    ).toBe("added label infra, removed label Feature, Bug");
  });

  it("words project and parent changes", () => {
    expect(
      describeHistoryEvent(
        "work_project_changed",
        { fromProject: null, toProject: "Docs" },
        t,
      ),
    ).toBe("added to project Docs");
    expect(
      describeHistoryEvent(
        "parent_changed",
        { fromParent: null, toParent: "ENG-72" },
        t,
      ),
    ).toBe("set parent issue ENG-72");
    expect(
      describeHistoryEvent(
        "duplicate_changed",
        { fromDuplicate: null, toDuplicate: "ENG-5" },
        t,
      ),
    ).toBe("marked this as a duplicate of ENG-5");
  });

  it("returns null for unknown types or empty data", () => {
    expect(describeHistoryEvent("status_changed", {}, t)).toBeNull();
    expect(describeHistoryEvent("labels_changed", {}, t)).toBeNull();
    expect(describeHistoryEvent("cycle_changed", null, t)).toBeNull();
  });
});
