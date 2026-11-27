// Tables a restore test counts, keyed by the name the admin page shows.
export const COUNTED_TABLES = {
  tickets: "task",
  documents: "document",
  chatMessages: "chat_message",
} as const;

export type CountedTable = keyof typeof COUNTED_TABLES;

export type TableCounts = Record<CountedTable, number>;
