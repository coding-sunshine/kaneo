import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { extractionModel } from "../../agent/extraction";
import { statementJudgementTable } from "../../database/schema";
import type { Reader } from "./current-statements";

export const JUDGEMENT_PROMPT_VERSION = 1;

/** Two wordings of one fact: what a document states and what the topic states now. */
export type Wordings = {
  slotName: string;
  value: string;
  quote: string;
  current: { value: string; quote: string };
};

// Everything the model is shown and nothing else, so that the same question
// has the same key.
export const wordingParts = (pair: Wordings) => [
  pair.slotName,
  pair.value,
  pair.quote,
  pair.current.value,
  pair.current.quote,
];

export const textsHash = (pair: Wordings) =>
  createHash("sha256")
    .update(JSON.stringify(wordingParts(pair)))
    .digest("hex");

/**
 * What the present prompt and model said about each pair of wordings: true
 * when they contradict, false when they do not, null when the answer could
 * not be read. A pair that was never asked about is absent.
 */
export async function judgementsOf(database: Reader, hashes: string[]) {
  if (hashes.length === 0) return new Map<string, boolean | null>();
  const rows = await database
    .select({
      textsHash: statementJudgementTable.textsHash,
      contradicts: statementJudgementTable.contradicts,
    })
    .from(statementJudgementTable)
    .where(
      and(
        inArray(statementJudgementTable.textsHash, hashes),
        eq(statementJudgementTable.promptVersion, JUDGEMENT_PROMPT_VERSION),
        eq(statementJudgementTable.model, extractionModel()),
      ),
    );
  return new Map(rows.map((row) => [row.textsHash, row.contradicts]));
}
