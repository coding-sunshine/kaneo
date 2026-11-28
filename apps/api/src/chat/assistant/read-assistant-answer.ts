import { z } from "zod";
import { dropRawIds } from "../../assist/drop-raw-ids";
import { sourceId } from "../../assist/source-id";

const MAX_ITEMS = 5;
const MAX_SOURCES = 5;

const items = z
  .array(
    z.object({
      text: z.string().trim().min(1).max(500),
      sources: z.array(z.string()).max(20).default([]),
    }),
  )
  .max(20)
  .default([]);
const answerSchema = z.object({ summary: items, open: items });

export type AssistantItem = { text: string; sources: string[] };
export type AssistantAnswer = {
  summary: AssistantItem[];
  open: AssistantItem[];
};

/**
 * Reads `{"summary": [...], "open": [...]}` from the model, also inside a
 * code fence. Only ids it was given count, and an item left with none is
 * dropped, so every line links to what it rests on. Each list keeps its first
 * five items, each with five sources, so the reply stays short. Null when
 * unreadable.
 */
export function readAssistantAnswer(
  text: string,
  givenIds: ReadonlySet<string>,
): AssistantAnswer | null {
  const json = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  let parsed: ReturnType<typeof answerSchema.safeParse>;
  try {
    parsed = answerSchema.safeParse(JSON.parse(json));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  const keep = (list: AssistantItem[]) =>
    list
      .map((item) => ({
        text: dropRawIds(item.text, givenIds),
        sources: [...new Set(item.sources.map(sourceId))]
          .filter((id) => givenIds.has(id))
          .slice(0, MAX_SOURCES),
      }))
      .filter((item) => item.sources.length > 0)
      .slice(0, MAX_ITEMS);
  return { summary: keep(parsed.data.summary), open: keep(parsed.data.open) };
}
