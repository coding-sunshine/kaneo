import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { extractJson, UnreadableAnswer } from "../agent/extraction";
import db from "../database";
import {
  taskExtractionProgressTable,
  taskStatementTable,
  topicSlotTable,
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
/** Parts of one text asked about at the same time. */
const AT_ONCE = 8;
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
  workspaceId: string;
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
 * Stores facts as proposals. A slot deleted while its text was read keeps
 * none: the slots that are left are locked until the facts are in, so a
 * deletion cannot come in between.
 */
const keep = (
  found: NonNullable<ReturnType<typeof keptStatements>>,
  source: Source,
) =>
  db.transaction(async (tx) => {
    const live = await tx
      .select({ id: topicSlotTable.id })
      .from(topicSlotTable)
      .where(
        inArray(
          topicSlotTable.id,
          found.map(({ slotId }) => slotId),
        ),
      )
      .for("key share");
    const ids = new Set(live.map(({ id }) => id));
    const kept = found.filter(({ slotId }) => ids.has(slotId));
    if (kept.length === 0) return;
    await tx
      .insert(taskStatementTable)
      .values(
        kept.map((statement) => ({
          ...statement,
          taskId: source.taskId,
          assetId: source.assetId,
        })),
      )
      // A fact that is already there stays as it is, dismissed or not.
      .onConflictDoNothing();
  });

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
  const save = () =>
    db
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
  while (next < parts.length) {
    if (outcome.parts <= 0) return "stop" as const;
    const batch = parts.slice(next, next + Math.min(AT_ONCE, outcome.parts));
    // Sent together, handled in order as each one settles, so the progress
    // of every answered part is kept even if a later part never comes back.
    const answers = batch.map((part) =>
      extractJson<unknown>({
        purpose: "task-facts",
        workspaceId: run.workspaceId,
        system: TASK_SYSTEM,
        text: taskQuestion(run.asked, source.head + part),
        schema: taskAnswerSchema(run.asked),
        reserve: RESERVE,
      }).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
    );
    // A stop or a failure goes on from the first part it hit; the parts after
    // it in the batch are asked again then.
    for (const [index, pending] of answers.entries()) {
      const settled = await pending;
      const part = batch[index] ?? "";
      if (settled.status === "rejected") {
        if (!(settled.reason instanceof UnreadableAnswer)) {
          console.error(
            `Reading ${source.key} for facts failed`,
            settled.reason,
          );
          return "failed" as const;
        }
      } else {
        if (!settled.value) return "stop" as const;
        const found = keptStatements(
          run.asked,
          settled.value,
          source.quotable ?? part,
        );
        if (found) readable = true;
        if (found?.length) await keep(found, source);
      }
      outcome.parts -= 1;
      next += 1;
      // After the facts of the part: a stop in between asks the part again,
      // and its facts are not stored twice.
      await save();
    }
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
