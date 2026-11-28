import { z } from "zod";

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  sources: z.array(z.string()).max(20).default([]),
});

/** The model's `{answer, sources}`; only ids it was given count. */
export function readAnswer(text: string, givenIds: ReadonlySet<string>) {
  const json = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  let parsed: ReturnType<typeof answerSchema.safeParse>;
  try {
    parsed = answerSchema.safeParse(JSON.parse(json));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  return {
    answer: parsed.data.answer,
    sources: [...new Set(parsed.data.sources)].filter((id) => givenIds.has(id)),
  };
}
