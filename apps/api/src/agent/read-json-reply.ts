import type { z } from "zod";

/** The model's JSON answer read against `schema`, also inside a code fence. */
export function readJsonReply<S extends z.ZodType>(
  text: string,
  schema: S,
): z.output<S> | null {
  const json = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  try {
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
