import { z } from "zod";

const summarySchema = z.object({
  currentState: z.string().trim().min(1).max(2000),
  blockers: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  comments: z.array(z.string()).max(50).default([]),
});
export type TaskSummary = z.infer<typeof summarySchema>;

/**
 * Reads the model's JSON summary, also inside a code fence. Only ids of
 * comments it was given count as used: an id it made up is dropped.
 */
export function readSummary(
  text: string,
  readIds: ReadonlySet<string>,
): TaskSummary | null {
  const json = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  let parsed: ReturnType<typeof summarySchema.safeParse>;
  try {
    parsed = summarySchema.safeParse(JSON.parse(json));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    comments: [...new Set(parsed.data.comments)].filter((id) =>
      readIds.has(id),
    ),
  };
}
