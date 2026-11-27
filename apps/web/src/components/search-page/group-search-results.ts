// Fixed group order on the search page, so groups do not jump around as
// relevance shifts between keystrokes. Unknown types go last.
const GROUP_ORDER = [
  "message",
  "task",
  "document",
  "project",
  "person",
  "comment",
  "activity",
  "workspace",
];

export function groupSearchResults<T extends { type: string }>(results: T[]) {
  const groups = new Map<string, T[]>();
  for (const result of results)
    groups.set(result.type, [...(groups.get(result.type) ?? []), result]);
  const rank = (type: string) => {
    const index = GROUP_ORDER.indexOf(type);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([type, items]) => ({ type, items }));
}
