import { z } from "zod";

const names = z.array(z.string().trim().min(1).max(200)).max(20).default([]);

/** What the model answers for a sentence: names, never ids. */
export const filterAnswerSchema = z.object({
  question: z.string().trim().min(1).max(300).nullable().default(null),
  assignee: names,
  labels: names,
  status: names,
  priority: names,
  blocked: z.boolean().default(false),
  createdOlderThanDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .nullable()
    .default(null),
});
export type FilterAnswer = z.infer<typeof filterAnswerSchema>;

type Named = { id: string; name: string };
export type FilterLookup = {
  /** The person asking: "me". */
  userId: string;
  members: Named[];
  labels: Named[];
  columns: Named[];
};

/** The board filter the sentence stands for, in the ids the board uses. */
export type ParsedFilters = {
  assignee?: string[];
  labels?: string[];
  status?: string[];
  priority?: string[];
  blocked?: true;
  createdAt?: string[];
};

export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;

/** Reads the model's JSON answer, also inside a code fence; null if it is not one. */
export function readFilterAnswer(text: string): FilterAnswer | null {
  const json = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  try {
    const parsed = filterAnswerSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const same = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

/**
 * Turns the model's names into the ids of what the person can see. A name
 * that matches nothing becomes a question, so no filter is ever guessed.
 */
export function resolveFilter(
  answer: FilterAnswer,
  lookup: FilterLookup,
): { filters: ParsedFilters | null; question: string | null } {
  const ask = (question: string) => ({ filters: null, question });
  if (answer.question) return ask(answer.question);

  const filters: ParsedFilters = {};
  const missing: string[] = [];
  const resolve = (wanted: string[], pool: Named[], all = false) =>
    wanted.flatMap((name) => {
      const found = pool.filter((item) => same(item.name, name));
      if (found.length === 0) missing.push(name);
      return (all ? found : found.slice(0, 1)).map((item) => item.id);
    });

  const assignee = answer.assignee.flatMap((name) =>
    same(name, "me") ? [lookup.userId] : resolve([name], lookup.members),
  );
  // Every label of that name, as picking its group by hand selects them all.
  const labels = resolve(answer.labels, lookup.labels, true);
  const status = resolve(answer.status, lookup.columns);
  if (missing.length > 0)
    return ask(
      `I could not find ${missing.map((name) => `"${name}"`).join(", ")}. Which one do you mean?`,
    );

  const priority = answer.priority
    .map((value) => value.toLowerCase())
    .filter((value) => (PRIORITIES as readonly string[]).includes(value));
  if (assignee.length) filters.assignee = [...new Set(assignee)];
  if (labels.length) filters.labels = [...new Set(labels)];
  if (status.length) filters.status = [...new Set(status)];
  if (priority.length) filters.priority = [...new Set(priority)];
  if (answer.blocked) filters.blocked = true;
  if (answer.createdOlderThanDays)
    filters.createdAt = [`olderThan:${answer.createdOlderThanDays}`];

  if (Object.keys(filters).length === 0)
    return ask(
      "What should the filter show? Name a person, label, status, priority or age.",
    );
  return { filters, question: null };
}
