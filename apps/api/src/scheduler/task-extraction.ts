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
import { seeWith } from "./file-vision";
import { ReadLater } from "./read-later";
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
 * Kept on each record. Raising it reads no text again that was read whole: a
 * text is asked about once. It reads once more, and only once, each file whose
 * record says it was cut short, too large or not parsed, and each PDF read
 * before every page was read: raise it when a reader reads more. To read
 * texts again on purpose, delete their records.
 */
export const PROMPT_VERSION = 2;
/** Texts the model is asked about in one run. Files that are not read do not count. */
const PER_TICK = 10;
/** Questions in one run. A longer text goes on in the next run. */
const PARTS_PER_RUN = 50;
const MAX_CHARACTERS = 12_000;
const OVERLAP = 200;
// A file is held in memory whole while it is read, and the API is one
// process. Nothing of it is written to disk.
const MAX_FILE_BYTES = 100_000_000;
// Records that a reader before this version left short: read once again.
const AGAIN = new Set(["truncated", "too_large", "unparsed"]);
// Issues are many and documents are few, so this job leaves a share of the
// day's tokens and of the spending cap to the job that reads documents.
const RESERVE = 0.3;

// What a file's place on the issue is called in the question.
const WHERE: Record<string, string> = {
  description: "Picture in the issue description",
  comment: "Picture in a comment on the issue",
};

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
  /** The text a quote must be found in. Without it: the part asked about. */
  quotable?: string;
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

// Where a text that stopped part way goes on, and whether a part of it had
// an answer. In memory only: after a restart the text is asked about from its
// start, and the facts found before are not stored twice.
const resume = new Map<string, { next: number; readable: boolean }>();

/**
 * Asks about the whole of one text, part by part, and stores what each part
 * states as proposals. `stop` when a cap or the run's questions are used up,
 * `failed` when a request failed; nothing is recorded then, and the text goes
 * on from that part later. Else whether any part had an answer.
 */
async function ask(run: Run, source: Source, outcome: Outcome) {
  const parts = textParts(source.body, MAX_CHARACTERS, OVERLAP);
  const at = `${source.key}:${source.contentHash}:${hashOf(JSON.stringify(run.asked))}`;
  const state = resume.get(at) ?? { next: 0, readable: false };
  resume.delete(at);
  for (; state.next < parts.length; state.next++) {
    const part = parts[state.next] ?? "";
    if (outcome.parts <= 0) {
      resume.set(at, state);
      return "stop" as const;
    }
    try {
      const answer = await extractJson<unknown>({
        purpose: "task-facts",
        system: TASK_SYSTEM,
        text: taskQuestion(run.asked, source.head + part),
        schema: taskAnswerSchema(run.asked),
        reserve: RESERVE,
      });
      if (!answer) {
        resume.set(at, state);
        return "stop" as const;
      }
      outcome.parts -= 1;
      const found = keptStatements(run.asked, answer, source.quotable ?? part);
      if (!found) continue;
      state.readable = true;
      if (found.length === 0) continue;
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
    } catch (error) {
      if (!(error instanceof UnreadableAnswer)) {
        resume.set(at, state);
        taskExtractionRetry.failed(source.key);
        console.error(`Reading ${source.key} for facts failed`, error);
        return "failed" as const;
      }
      outcome.parts -= 1;
    }
  }
  return { readable: state.readable };
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
async function read(run: Run, source: Source, outcome: Outcome) {
  const answer = await ask(run, source, outcome);
  if (answer === "stop" || answer === "failed") return answer;
  await record(
    run,
    source,
    answer.readable,
    answer.readable ? null : "no_answer",
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
  const text = collapse(source.quotable ?? source.body);
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

type Outcome = {
  left: number;
  /** Questions left in this run. */
  parts: number;
  degraded: boolean;
  stop: boolean;
};

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
      return handle(await read(later(run, since), source, outcome));
    }
    await dropStale(source);
    handle(await read(run, source, outcome));
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
        surface: assetTable.surface,
        since: taskExtractionTable.createdAt,
        hash: taskExtractionTable.contentHash,
        reason: taskExtractionTable.reason,
        version: taskExtractionTable.promptVersion,
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
          // Files attached to the issue, and pictures (kind `image`) attached
          // or inside its description or a comment, which the model writes out.
          inArray(assetTable.kind, ["attachment", "image"]),
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
  // Read once more, and only once, after a reader that reads more shipped.
  const again = ({
    since,
    reason,
    version,
    filename,
    mimeType,
  }: (typeof files)[number]) =>
    since !== null &&
    (version ?? PROMPT_VERSION) < PROMPT_VERSION &&
    (AGAIN.has(reason ?? "") ||
      (reason === null && fileKind(filename, mimeType) === "pdf"));
  const see = seeWith(RESERVE, outcome);
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
    // recorded as unparsed, not tried again. A text too long for one string
    // is too large.
    let text = "";
    try {
      text = await readFileText(kind, bytes, file.filename, see);
    } catch (error) {
      if (error instanceof ReadLater) {
        if (error.failed) {
          taskExtractionRetry.failed(key);
          outcome.degraded = true;
        } else outcome.stop = true;
        return;
      }
      if (error instanceof RangeError) {
        await record(run, unread, false, "too_large");
        return;
      }
    }
    if (!/\S/.test(text)) {
      await record(run, unread, false, "unparsed");
      return;
    }
    const contentHash = hashOf(text);
    if ((holder.get(contentHash) ?? file.id) !== file.id) {
      await record(run, { ...unread, contentHash }, false, "duplicate");
      return;
    }
    // A PDF read again whose text is the same was read whole: its record is
    // renewed, and nothing is asked twice.
    if (again(file) && contentHash === file.hash && file.reason === null) {
      await record(
        { ...run, upTo: file.since ?? run.upTo },
        { ...unread, contentHash },
        true,
        null,
      );
      return;
    }
    const result = await read(
      since ? later(run, since) : run,
      {
        key,
        taskId: file.taskId,
        assetId: file.id,
        contentHash,
        // The title is not the file: a quote from it does not count, so a
        // quote is looked for in the part asked about.
        head: `Title: ${collapse(file.title)}\n\n${WHERE[file.surface] ?? "Attached file"} ${collapse(file.filename)}:\n`,
        body: text,
      },
      outcome,
    );
    if (result === "read") holder.set(contentHash, file.id);
    handle(result);
  };

  const behind = ({ since }: { since: Date | null }) =>
    since !== null && since < run.upTo;
  // Smaller files first: a file longer than a run goes on where it stopped in
  // the next run, and must not hold back every file behind it until it ends.
  const bySize = (a: (typeof files)[number], b: (typeof files)[number]) =>
    a.size - b.size;
  // Texts with new words go first, so a new comment does not wait behind a
  // new slot that every old text is asked about.
  const queue = [
    ...issues
      .filter(({ since }) => since === null)
      .map((issue) => () => readIssue(issue)),
    ...files
      .filter(
        (file) =>
          file.since === null ||
          (file.reason === "duplicate" && !holder.has(file.hash ?? "")) ||
          // Recorded before a reader for its kind shipped: read it once now.
          (file.reason === "unsupported" &&
            fileKind(file.filename, file.mimeType) !== null) ||
          again(file),
      )
      .sort(bySize)
      .map((file) => () => readFile(file, null)),
    ...issues.filter(behind).map((issue) => () => readIssue(issue)),
    ...files
      .filter(
        (file) =>
          holder.get(file.hash ?? "") === file.id &&
          behind(file) &&
          !again(file),
      )
      .sort(bySize)
      .map((file) => () => readFile(file, file.since)),
  ];
  for (const next of queue) {
    if (outcome.stop || outcome.left <= 0) return;
    await next();
  }
}

/**
 * Asks the model which facts each issue, each file on an issue and each
 * picture inside its text states for the slots of the workspace's topics, and
 * stores them as proposals. A proposal changes nothing a topic states: a person puts the
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
  const outcome: Outcome = {
    left: PER_TICK,
    parts: PARTS_PER_RUN,
    degraded: false,
    stop: false,
  };
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
