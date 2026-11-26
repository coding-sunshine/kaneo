import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
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
import { fileKind, fileText } from "./task-file-text";
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

/** Raise it when the prompt or the answer's schema changes: everything is read again. */
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
type Run = { model: string; slotsHash: string; asked: Asked };

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

const record = (
  run: Run,
  source: Pick<Source, "taskId" | "assetId" | "contentHash">,
  readable: boolean,
  reason: string | null,
) =>
  db
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
    })
    .onConflictDoNothing();

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

async function issueSource(taskId: string, contentHash: string) {
  const [task] = await db
    .select({ title: taskTable.title, description: taskTable.description })
    .from(taskTable)
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
    contentHash,
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

async function readWorkspace(
  workspaceId: string,
  run: Run,
  outcome: Outcome,
): Promise<void> {
  // The owner's rule: a text is never asked about twice. A record for the
  // same words ends it, whatever the topics, slots, prompt or model were. So
  // a topic or slot added later gets no facts from texts already read.
  const handle = (result: Awaited<ReturnType<typeof read>>) => {
    outcome.left -= 1;
    if (result === "stop") outcome.stop = true;
    if (result === "failed") outcome.degraded = true;
  };

  const issues = await db
    .select({ id: taskTable.id, hash: issueHash })
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
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(taskExtractionTable.id),
      ),
    )
    .orderBy(asc(taskTable.id));
  for (const issue of issues) {
    if (outcome.stop || outcome.left <= 0) return;
    if (taskExtractionRetry.waiting(`issue:${issue.id}`)) continue;
    const source = await issueSource(issue.id, issue.hash);
    if (!source) continue;
    await dropStale(source);
    handle(await read(run, source));
  }

  const files = await db
    .select({
      id: assetTable.id,
      taskId: taskTable.id,
      title: taskTable.title,
      filename: assetTable.filename,
      mimeType: assetTable.mimeType,
      size: assetTable.size,
      objectKey: assetTable.objectKey,
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
        isNull(taskExtractionTable.id),
      ),
    )
    .orderBy(asc(assetTable.id));
  for (const file of files) {
    if (outcome.stop || outcome.left <= 0) return;
    const key = `file:${file.id}`;
    if (taskExtractionRetry.waiting(key)) continue;
    const unread = { taskId: file.taskId, assetId: file.id, contentHash: "" };
    const kind = fileKind(file.filename, file.mimeType);
    if (!kind || file.size > MAX_FILE_BYTES) {
      await record(run, unread, false, kind ? "too_large" : "unsupported");
      continue;
    }
    let text: string;
    try {
      const { body } = await getPrivateObject(file.objectKey);
      text = fileText(kind, await new Response(body as BodyInit).text());
    } catch (error) {
      // The file store did not answer: the file is read later.
      taskExtractionRetry.failed(key);
      outcome.degraded = true;
      console.error(`Fetching ${key} to read it for facts failed`, error);
      continue;
    }
    if (!collapse(text)) {
      await record(run, unread, false, "unparsed");
      continue;
    }
    handle(
      await read(run, {
        key,
        taskId: file.taskId,
        assetId: file.id,
        contentHash: hashOf(text),
        head: `Title: ${collapse(file.title)}\n\nAttached file ${collapse(file.filename)}:\n`,
        body: text,
        // The title is not the file: a quote from it does not count.
        quotable: text,
      }),
    );
  }
}

/**
 * Asks the model which facts each issue, and each text file on an issue,
 * states for the slots of the workspace's topics, and stores them as
 * proposals. A proposal changes nothing a topic states: a person puts the
 * issue on the topic or dismisses the fact. A text is asked about once: an
 * issue again only when its words change, a file never again. Every file
 * gets a record, read or not. Does nothing without a key or once this job's share
 * of a cap is used up.
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
        asked: numbered(list),
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
