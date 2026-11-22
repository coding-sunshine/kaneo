export type ChatGroupKey = "today" | "yesterday" | "week" | "older";

const ORDER: ChatGroupKey[] = ["today", "yesterday", "week", "older"];
const DAY = 86_400_000;

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** Buckets chats by how recently they were updated, newest bucket first. */
export function groupChatsByRecency<T extends { updatedAt: string }>(
  chats: T[],
  now = new Date(),
) {
  const today = startOfDay(now);
  const buckets: Record<ChatGroupKey, T[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };
  for (const chat of chats) {
    const day = startOfDay(new Date(chat.updatedAt));
    const key: ChatGroupKey =
      day >= today
        ? "today"
        : day >= today - DAY
          ? "yesterday"
          : day >= today - 7 * DAY
            ? "week"
            : "older";
    buckets[key].push(chat);
  }
  return ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    chats: buckets[key],
  }));
}
