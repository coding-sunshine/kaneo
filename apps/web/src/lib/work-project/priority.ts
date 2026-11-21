// The API stores Linear's numeric priority: 0 none, 1 urgent ... 4 low.
const KEYS = ["no-priority", "urgent", "high", "medium", "low"] as const;

export function workProjectPriorityKey(priority: number) {
  return KEYS[priority] ?? KEYS[0];
}

export function workProjectPriorityFromKey(key: string) {
  const index = KEYS.indexOf(key as (typeof KEYS)[number]);
  return index < 0 ? 0 : index;
}

export const WORK_PROJECT_PRIORITY_KEYS = KEYS;
