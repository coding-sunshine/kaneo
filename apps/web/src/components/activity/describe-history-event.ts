import { cycleTitle } from "@/lib/cycle/cycle-label";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const text = (value: unknown) =>
  typeof value === "string" && value ? value : null;
const names = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((name): name is string => typeof name === "string")
    : [];
const cycle = (value: unknown) =>
  typeof value === "number" ? cycleTitle({ number: value, name: null }) : null;

// Linear-style wording for the history events that carry from/to values.
export function describeHistoryEvent(
  type: string,
  eventData: Record<string, unknown> | null,
  t: Translate,
): string | null {
  if (!eventData) return null;
  switch (type) {
    case "cycle_changed": {
      const from = cycle(eventData.fromCycle);
      const to = cycle(eventData.toCycle);
      if (from && to) return t("activity:cycleChanged", { from, to });
      if (to) return t("activity:cycleAdded", { to });
      return from ? t("activity:cycleRemoved", { from }) : null;
    }
    case "labels_changed": {
      const added = names(eventData.addedLabels);
      const removed = names(eventData.removedLabels);
      const parts = [
        added.length && t("activity:addedLabel", { names: added.join(", ") }),
        removed.length &&
          t("activity:removedLabel", { names: removed.join(", ") }),
      ].filter(Boolean);
      return parts.length ? parts.join(", ") : null;
    }
    case "work_project_changed": {
      const from = text(eventData.fromProject);
      const to = text(eventData.toProject);
      if (from && to) return t("activity:changedProject", { from, to });
      if (to) return t("activity:addedToProject", { to });
      return from ? t("activity:removedFromProject", { from }) : null;
    }
    case "parent_changed": {
      const from = text(eventData.fromParent);
      const to = text(eventData.toParent);
      if (from && to) return t("activity:changedParent", { from, to });
      if (to) return t("activity:setParent", { to });
      return from ? t("activity:removedParent", { from }) : null;
    }
    default:
      return null;
  }
}
