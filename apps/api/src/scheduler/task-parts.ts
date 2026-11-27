import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { extractJson, UnreadableAnswer } from "../agent/extraction";
import db from "../database";
import {
  taskExtractionProgressTable,
  taskStatementTable,
} from "../database/schema";
import {
  type Asked,
  type AskedTopic,
  keptStatements,
  TASK_SYSTEM,
  taskAnswerSchema,
  taskQuestion,
} from "./task-question";
import { textParts } from "./text-parts";

const MAX_CHARACTERS = 12_000;
const OVERLAP = 200;
// Issues are many and documents are few, so this job leaves a share of the
// day's tokens and of the spending cap to the job that reads documents.
export const RESERVE = 0.3;

export type Source = {
  key: string;
  taskId: string;
  assetId: string | null;
  contentHash: string;
  /** What every part of the question starts with. */
  head: string;
  body: string;
  /** The text a quote must be found in. Without it: the part asked about. */
  quotable?: string;
};
export type Run = {
  model: string;
  slotsHash: string;
  topics: AskedTopic[];
  asked: Asked;
  /** When the newest slot of the workspace was made. */
  upTo: Date;
};

export const hashOf = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/**
 * Asks about the whole of one text, part by part, and stores what each part
 * states as proposals. After each part, the part to go on with is kept in the
 * database, so a run that stops, or a process that stops, loses no part.
 * `stop` when a cap or the run's questions are used up, `failed` when a
 * request failed; nothing is recorded then, and the text goes on from that
 * part later. Else whether any part had an answer.
 */
export async function ask(run: Run, source: Source, outcome: Outcome) {
  const parts = textParts(source.body, MAX_CHARACTERS, OVERLAP);
  const key = `${source.key}:${source.contentHash}:${hashOf(JSON.stringify(run.asked))}`;
  const [saved] = await db
    .select({
      next: taskExtractionProgressTable.next,
      readable: taskExtractionProgressTable.readable,
    })
    .from(taskExtractionProgressTable)
    .where(eq(taskExtractionProgressTable.key, key));
  let { next, readable } = saved ?? { next: 0, readable: false };
  for (; next < parts.length;) {
    const part = parts[next] ?? "";
    if (outcome.parts <= 0) return "stop" as const;
    try {
      const answer = await extractJson<unknown>({
        purpose: "task-facts",
        system: TASK_SYSTEM,
        text: taskQuestion(run.asked, source.head + part),
        schema: taskAnswerSchema(run.asked),
        reserve: RESERVE,
      });
      if (!answer) return "stop" as const;
      const found = keptStatements(run.asked, answer, source.quotable ?? part);
      if (found) readable = true;
      if (found?.length) {
        await db
          .insert(taskStatementTable)
          .values(
            found.map((statement) => ({
              ...statement,
              taskId: source.taskId,
              assetId: source.assetId,
            })),
          )
          // A fact that is already there stays as it is, dismissed or not.
          .onConflictDoNothing();
      }
    } catch (error) {
      if (!(error instanceof UnreadableAnswer)) {
        console.error(`Reading ${source.key} for facts failed`, error);
        return "failed" as const;
      }
    }
    outcome.parts -= 1;
    next += 1;
    // After the facts of the part: a stop in between asks the part again,
    // and its facts are not stored twice.
    await db
      .insert(taskExtractionProgressTable)
      .values({
        key,
        taskId: source.taskId,
        assetId: source.assetId,
        next,
        readable,
      })
      .onConflictDoUpdate({
        target: taskExtractionProgressTable.key,
        set: { next, readable },
      });
  }
  await db
    .delete(taskExtractionProgressTable)
    .where(eq(taskExtractionProgressTable.key, key));
  return { readable };
}

export type Outcome = {
  left: number;
  /** Questions left in this run. */
  parts: number;
  degraded: boolean;
  stop: boolean;
};
