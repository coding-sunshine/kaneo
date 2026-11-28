import { z } from "zod";
import type { MeetingNotesProposal } from "./proposal-type";

const proposalSchema = z.object({
  decisions: z
    .array(
      z.object({ text: z.string().trim().min(1).max(500), quote: z.string() }),
    )
    .max(30)
    .default([]),
  actionItems: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).default(""),
        quote: z.string(),
      }),
    )
    .max(30)
    .default([]),
});

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Reads the model's proposal. An item is kept only when its quote appears in
 * the transcript word for word (spacing aside), so every decision and ticket
 * points at something that was said.
 */
export function readProposal(
  text: string,
  transcript: string,
): MeetingNotesProposal | null {
  const json = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  let parsed: ReturnType<typeof proposalSchema.safeParse>;
  try {
    parsed = proposalSchema.safeParse(JSON.parse(json));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  const said = squash(transcript);
  const quoted = <T extends { quote: string }>(item: T) =>
    squash(item.quote).length > 0 && said.includes(squash(item.quote));
  return {
    decisions: parsed.data.decisions.filter(quoted),
    actionItems: parsed.data.actionItems.filter(quoted),
  };
}
