export type ActivityGroupKey = "thisWeek" | "lastWeek" | "thisMonth" | "older";

/** Midnight on the Sunday of the week `now` falls in, local time, as Linear groups. */
// Calendar arithmetic, not milliseconds, so a daylight-saving change cannot shift it.
function startOfWeek(now: Date, weeksBack = 0) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - now.getDay() - 7 * weeksBack,
  );
}

/**
 * Linear's Documents groups: this week, last week, the rest of this month,
 * then everything older. Order inside a group is kept; empty groups are left out.
 */
export function activityGroups<T extends { updatedAt: string | Date }>(
  documents: T[],
  now = new Date(),
) {
  const thisWeek = startOfWeek(now).getTime();
  const lastWeek = startOfWeek(now, 1).getTime();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const keyOf = (document: T): ActivityGroupKey => {
    const time = new Date(document.updatedAt).getTime();
    if (time >= thisWeek) return "thisWeek";
    if (time >= lastWeek) return "lastWeek";
    if (time >= thisMonth) return "thisMonth";
    return "older";
  };
  const order: ActivityGroupKey[] = [
    "thisWeek",
    "lastWeek",
    "thisMonth",
    "older",
  ];
  return order
    .map((key) => ({
      key,
      documents: documents.filter((document) => keyOf(document) === key),
    }))
    .filter((group) => group.documents.length > 0);
}
