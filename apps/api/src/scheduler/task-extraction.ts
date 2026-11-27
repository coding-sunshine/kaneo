import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  extractJson,
  extractionModel,
  UnreadableAnswer,
} from "../agent/extraction";
import { isAgentEnabled } from "../agent/openrouter";
import db from "../database";
import {
  activityTable,
  assetTable,
  projectTable,
  taskExtractionTable,
  taskStatementTable,
  taskTable,
  topicTable,
} from "../database/schema";
import { getPrivateObject } from "../storage/s3";
import { slotsOf } from "../topic/controllers/slots";
import { collapse, quoteStart } from "../topic/statement-text";
import { retryLater } from "./retry-later";
import { fileKind, readFileText } from "./task-file-text";
import {
  type Asked,
  type AskedTopic,
  keptStatements,
  numbered,
  TASK_SYSTEM,
  taskAnswerSchema,
  taskQuestion,
} from "./task-question";
import { textParts } from "./text-parts";

/**
 * Kept on each record. Raising it reads nothing again: a text is asked about
 * once. To read texts again on purpose, delete their records.
 */
export const PROMPT_VERSION = 1;
/** Texts the model is asked about in one run. Files that are not read do not count. */
const PER_TICK = 10;
const MAX_CHARACTERS = 12_000;
// ponytail: a text is read in at most 10 parts, so about 120,000 characters.
// The record says `truncated` when a text was longer.
const MAX_PARTS = 10;
const OVERLAP = 200;
// A file is held in memory whole, and the API is one process.
const MAX_FILE_BYTES = 5_000_000;
// Issues are many and documents are few, so this job leaves a share of the
// day's tokens and of the spending cap to the job that reads documents.
const RESERVE = 0.3;

/** A text whose request failed is asked about again after an hour. */
export const taskExtractionRetry = retryLater(60 * 60_000);

type Source = {
  key: string;
  taskId: string;
  assetId: string | null;
  contentHash: string;
  /** What every part of the question starts with. */
  head: string;
  body: string;
  /** The text a quote must be found in. */
  quotable: string;
};
type Run = {
  model: string;
  slotsHash: string;
  topics: AskedTopic[];
  asked: Asked;
  /** When the newest slot of the workspace was made. */
  upTo: Date;
};

const hashOf = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/**
 * Asks about one text, part by part. `stop` when a cap is used up, `failed`
 * when a request failed; nothing is recorded then and the text is asked about
 * again. Else the statements to keep, and null when no answer could be read.
 */
async function ask(run: Run, source: Source) {
  const parts = textParts(source.body, MAX_CHARACTERS, OVERLAP);
  const kept: NonNullable<ReturnType<typeof keptStatements>> = [];
  let readable = false;
  for (const part of parts.slice(0, MAX_PARTS)) {
    try {
      const answer = await extractJson<unknown>({
        purpose: "task-facts",
        system: TASK_SYSTEM,
        text: taskQuestion(run.asked, source.head + part),
        schema: taskAnswerSchema(run.asked),
        reserve: RESERVE,
      });
      if (!answer) return "stop" as const;
      const found = keptStatements(run.asked, answer, source.quotable);
      if (found) {
        readable = true;
        kept.push(...found);
      }
    } catch (error) {
      if (!(error instanceof UnreadableAnswer)) {
        taskExtractionRetry.failed(source.key);
        console.error(`Reading ${source.key} for facts failed`, error);
        return "failed" as const;
      }
    }
  }
  return { kept: readable ? kept : null, truncated: parts.length > MAX_PARTS };
}

// One record for each text: the one before it goes. Its time is not when it
// was written. It is when the newest slot the text was asked about was made,
// so a slot made later, even while a run was on, is still asked of the text.
const record = (
  run: Run,
  source: Pick<Source, "taskId" | "assetId" | "contentHash">,
  readable: boolean,
  reason: string | null,
) =>
  db.transaction(async (tx) => {
    await tx
      .delete(taskExtractionTable)
      .where(
        and(
          eq(taskExtractionTable.taskId, source.taskId),
          source.assetId
            ? eq(taskExtractionTable.assetId, source.assetId)
            : isNull(taskExtractionTable.assetId),
        ),
      );
    await tx
      .insert(taskExtractionTable)
      .values({
        taskId: source.taskId,
        assetId: source.assetId,
        contentHash: source.contentHash,
        slotsHash: run.slotsHash,
        promptVersion: PROMPT_VERSION,
        model: run.model,
        readable,
        reason,
        createdAt: run.upTo,
      })
      // Another API instance wrote the same record first.
      .onConflictDoNothing();
  });

// ponytail: slots are told apart by the time they were made, to the
// millisecond. A slot whose insert is still open while a newer slot is read
// is never asked of the texts of that run. Give records a slot list when
// slots are made by a script and not by hand.
/** The same run, about the slots made after `since` only. */
const later = (run: Run, since: Date): Run => ({
  ...run,
  asked: numbered(
    run.topics
      .map((topic) => ({
        ...topic,
        slots: topic.slots.filter((slot) => slot.createdAt > since),
      }))
      .filter((topic) => topic.slots.length > 0),
  ),
});

/** Asks, stores what was found as proposals and records that the text was read. */
async function read(run: Run, source: Source) {
  const answer = await ask(run, source);
  if (answer === "stop" || answer === "failed") return answer;
  if (answer.kept?.length) {
    await db
      .insert(taskStatementTable)
      .values(
        answer.kept.map((statement) => ({
          ...statement,
          taskId: source.taskId,
          assetId: source.assetId,
        })),
      )
      // A fact that is already there stays as it is, dismissed or not.
      .onConflictDoNothing();
  }
  await record(
    run,
    source,
    answer.kept !== null,
    answer.kept === null ? "no_answer" : answer.truncated ? "truncated" : null,
  );
  return "read" as const;
}

// Changes when the title, the description or a comment changes.
// ponytail: computed for every issue of the workspace on every run. Store the
// hash on the issue when a workspace has tens of thousands of them.
const issueHash = sql<string>`md5(${taskTable.title} || E'\\n' || coalesce(${taskTable.description}, '') || E'\\n' || coalesce((
  select string_agg(${activityTable.content}, E'\\n' order by ${activityTable.createdAt}, ${activityTable.id})
  from ${activityTable}
  where ${activityTable.taskId} = ${taskTable.id} and ${activityTable.type} = 'comment'
), ''))`;

// The hash is taken with the words, not from the list of the run: words that
// came in since then are sent once, under their own hash.
async function issueSource(taskId: string) {
  const [task] = await db
    .select({
      title: taskTable.title,
      description: taskTable.description,
      contentHash: issueHash,
    })
    .from(taskTable)
    // The join is for the hash: a query on one table names its columns
    // without the table, and the hash then finds no comment of the issue.
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId));
  if (!task) return null;
  const comments = await db
    .select({ content: activityTable.content })
    .from(activityTable)
    .where(
      and(eq(activityTable.taskId, taskId), eq(activityTable.type, "comment")),
    )
    .orderBy(asc(activityTable.createdAt), asc(activityTable.id));
  const said = comments
    .map(({ content }) => collapse(content ?? ""))
    .filter(Boolean);
  const title = collapse(task.title);
  const description = collapse(task.description ?? "");
  const body = [
    description && `Description:\n${description}`,
    said.length > 0 &&
      `Comments:\n${said.map((text) => `- ${text}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    key: `issue:${taskId}`,
    taskId,
    assetId: null,
    contentHash: task.contentHash,
    head: `Title: ${title}\n\n`,
    body,
    quotable: `${title}\n${body}`,
  } satisfies Source;
}

// The words of an issue can change. A proposal whose quote is no longer in
// them goes, except one a person dismissed: that decision is kept.
async function dropStale(source: Source) {
  const text = collapse(source.quotable);
  const facts = await db
    .select({ id: taskStatementTable.id, quote: taskStatementTable.quote })
    .from(taskStatementTable)
    .where(
      and(
        eq(taskStatementTable.taskId, source.taskId),
        isNull(taskStatementTable.assetId),
        isNull(taskStatementTable.dismissedAt),
      ),
    );
  const gone = facts.filter(({ quote }) => quoteStart(text, quote) < 0);
  if (gone.length === 0) return;
  await db.delete(taskStatementTable).where(
    inArray(
      taskStatementTable.id,
      gone.map(({ id }) => id),
    ),
  );
}

type Outcome = { left: number; degraded: boolean; stop: boolean };

// The newest of each id's rows, which come newest first.
const newest = <Row extends { id: string }>(rows: Row[]) =>
  rows.filter((row, index) => row.id !== rows[index - 1]?.id);

async function readWorkspace(
  workspaceId: string,
  run: Run,
  outcome: Outcome,
): Promise<void> {
  // The owner's rule: the same words are never asked about the same slot
  // twice. A text with no record for its words is asked about every slot. A
  // text that has one is asked again only about the slots made after it. A
  // rename, a deleted slot, another prompt or another model asks nothing.
  const handle = (result: Awaited<ReturnType<typeof read>>) => {
    outcome.left -= 1;
    if (result === "stop") outcome.stop = true;
    if (result === "failed") outcome.degraded = true;
  };

  // The build before this one could leave several records for the same words.
  const issues = newest(
    await db
      .select({
        id: taskTable.id,
        hash: issueHash,
        since: taskExtractionTable.createdAt,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .leftJoin(
        taskExtractionTable,
        and(
          eq(taskExtractionTable.taskId, taskTable.id),
          isNull(taskExtractionTable.assetId),
          eq(taskExtractionTable.contentHash, issueHash),
        ),
      )
      .where(eq(projectTable.workspaceId, workspaceId))
      .orderBy(asc(taskTable.id), desc(taskExtractionTable.createdAt)),
  );
  const readIssue = async ({ id, hash, since }: (typeof issues)[number]) => {
    if (taskExtractionRetry.waiting(`issue:${id}`)) return;
    const source = await issueSource(id);
    if (!source) return;
    if (since) {
      // New words since the list was made: the next run reads them in full.
      if (source.contentHash !== hash) return;
      return handle(await read(later(run, since), source));
    }
    await dropStale(source);
    handle(await read(run, source));
  };

  const files = newest(
    await db
      .select({
        id: assetTable.id,
        taskId: taskTable.id,
        title: taskTable.title,
        filename: assetTable.filename,
        mimeType: assetTable.mimeType,
        size: assetTable.size,
        objectKey: assetTable.objectKey,
        since: taskExtractionTable.createdAt,
        hash: taskExtractionTable.contentHash,
        reason: taskExtractionTable.reason,
      })
      .from(assetTable)
      .innerJoin(taskTable, eq(taskTable.id, assetTable.taskId))
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .leftJoin(
        taskExtractionTable,
        eq(taskExtractionTable.assetId, assetTable.id),
      )
      .where(
        and(
          eq(projectTable.workspaceId, workspaceId),
          // Pictures in the text are kind `image`. They are not read.
          eq(assetTable.kind, "attachment"),
        ),
      )
      .orderBy(asc(assetTable.id), desc(taskExtractionTable.createdAt)),
  );
  // The one file that is asked about each text. A file with the same text is
  // recorded as `duplicate` and is read only once that file is gone.
  // ponytail: the facts show on that one file's issue only. Copy them to the
  // other issue when people who can open one and not the other miss a fact.
  const holder = new Map<string, string>();
  for (const { id, hash, reason } of files) {
    if (hash && reason !== "duplicate" && !holder.has(hash)) {
      holder.set(hash, id);
    }
  }
  const readFile = async (file: (typeof files)[number], since: Date | null) => {
    const key = `file:${file.id}`;
    if (taskExtractionRetry.waiting(key)) return;
    const unread = { taskId: file.taskId, assetId: file.id, contentHash: "" };
    const kind = fileKind(file.filename, file.mimeType);
    if (!kind || file.size > MAX_FILE_BYTES) {
      await record(run, unread, false, kind ? "too_large" : "unsupported");
      return;
    }
    let bytes: Uint8Array;
    try {
      const { body } = await getPrivateObject(file.objectKey);
      bytes = new Uint8Array(
        await new Response(body as BodyInit).arrayBuffer(),
      );
    } catch (error) {
      // The file store did not answer: the file is read later.
      taskExtractionRetry.failed(key);
      outcome.degraded = true;
      console.error(`Fetching ${key} to read it for facts failed`, error);
      return;
    }
    // A file that cannot be parsed, or an archive that passes a cap, is
    // recorded as unparsed, not tried again.
    const text = await readFileText(kind, bytes, file.filename).catch(() => "");
    if (!collapse(text)) {
      await record(run, unread, false, "unparsed");
      return;
    }
    const contentHash = hashOf(text);
    if ((holder.get(contentHash) ?? file.id) !== file.id) {
      await record(run, { ...unread, contentHash }, false, "duplicate");
      return;
    }
    const result = await read(since ? later(run, since) : run, {
      key,
      taskId: file.taskId,
      assetId: file.id,
      contentHash,
      head: `Title: ${collapse(file.title)}\n\nAttached file ${collapse(file.filename)}:\n`,
      body: text,
      // The title is not the file: a quote from it does not count.
      quotable: text,
    });
    if (result === "read") holder.set(contentHash, file.id);
    handle(result);
  };

  const behind = ({ since }: { since: Date | null }) =>
    since !== null && since < run.upTo;
  // Texts with new words go first, so a new comment does not wait behind a
  // new slot that every old text is asked about.
  const queue = [
    ...issues
      .filter(({ since }) => since === null)
      .map((issue) => () => readIssue(issue)),
    ...files
      .filter(
        ({ since, hash, reason, filename, mimeType }) =>
          since === null ||
          (reason === "duplicate" && !holder.has(hash ?? "")) ||
          // Recorded before a reader for its kind shipped: read it once now.
          (reason === "unsupported" && fileKind(filename, mimeType) !== null),
      )
      .map((file) => () => readFile(file, null)),
    ...issues.filter(behind).map((issue) => () => readIssue(issue)),
    ...files
      .filter((file) => holder.get(file.hash ?? "") === file.id && behind(file))
      .map((file) => () => readFile(file, file.since)),
  ];
  for (const next of queue) {
    if (outcome.stop || outcome.left <= 0) return;
    await next();
  }
}

/**
 * Asks the model which facts each issue, and each text file on an issue,
 * states for the slots of the workspace's topics, and stores them as
 * proposals. A proposal changes nothing a topic states: a person puts the
 * issue on the topic or dismisses the fact. The same words are asked about a
 * slot once: an issue is read again when its words change, and every text is
 * asked once more about a slot made after it was read. Every file gets a
 * record, read or not. Does nothing without a key or once this job's share of
 * a cap is used up.
 */
export async function extractTaskFacts() {
  if (!isAgentEnabled()) return {};
  const slots = await slotsOf();
  if (slots.size === 0) return {};
  const topics = await db
    .select({
      id: topicTable.id,
      name: topicTable.name,
      workspaceId: topicTable.workspaceId,
    })
    .from(topicTable)
    .where(inArray(topicTable.id, [...slots.keys()]))
    .orderBy(asc(topicTable.name), asc(topicTable.id));
  // ponytail: workspaces are read one after the other, so one workspace's
  // catch-up on a new slot goes before the new words of the next. Run every
  // workspace's new words first when an instance holds more than one busy
  // workspace.
  // ponytail: every topic of the workspace goes into every question. Pick the
  // topics per issue when a workspace has more than a few dozen.
  const byWorkspace = new Map<string, AskedTopic[]>();
  for (const { workspaceId, id, name } of topics) {
    byWorkspace.set(workspaceId, [
      ...(byWorkspace.get(workspaceId) ?? []),
      { id, name, slots: slots.get(id) ?? [] },
    ]);
  }

  const model = extractionModel();
  const outcome: Outcome = { left: PER_TICK, degraded: false, stop: false };
  for (const [workspaceId, list] of byWorkspace) {
    if (outcome.stop || outcome.left <= 0) break;
    await readWorkspace(
      workspaceId,
      {
        model,
        topics: list,
        asked: numbered(list),
        upTo: new Date(
          Math.max(
            ...list.flatMap(({ slots: own }) =>
              own.map((slot) => slot.createdAt.getTime()),
            ),
          ),
        ),
        slotsHash: hashOf(
          JSON.stringify(
            list.map(({ id, name, slots: own }) => [
              id,
              name,
              own.map((slot) => [slot.id, slot.name, slot.type, slot.options]),
            ]),
          ),
        ),
      },
      outcome,
    );
  }
  return { degraded: outcome.degraded };
}
