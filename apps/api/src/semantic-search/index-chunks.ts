import { and, asc, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import { aiEnabledChannel } from "../assist/ai-allowed-channel";
import { embed, isSemanticSearchEnabled } from "../assist/embeddings";
import db from "../database";
import {
  chatChannelTable,
  chatMessageTable,
  documentTable,
  projectTable,
  semanticChunkTable,
  semanticIndexStateTable,
  semanticSearchSettingTable,
  taskTable,
} from "../database/schema";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";
import { documentText, md5, messageText, taskText } from "./source-text";
import { embeddingEgressAllowed } from "./workspace-setting";

const BATCH = 64;

type Kind = "message" | "task" | "document";
type Column = "messageId" | "taskId" | "documentId";
type Mark = { lastAt: string; lastId: string };
type Row = {
  sourceId: string;
  text: string;
  hash: string;
  stale: boolean;
  at: string;
};

const COLUMN: Record<Kind, Column> = {
  message: "messageId",
  task: "taskId",
  document: "documentId",
};

// No embedding yet, or one of older text.
const staleOf = (hash: SQL<string>) =>
  sql<boolean>`(${semanticChunkTable.id} is null or ${semanticChunkTable.contentHash} <> ${hash})`;

// Rows changed after the mark, in change order, so a run reads only what
// changed since the last one.
const afterMark = (at: SQL, id: SQL, mark: Mark) =>
  sql`(${at}, ${id}) > (${mark.lastAt}::timestamp, ${mark.lastId})`;

function changedMessages(workspaceId: string, mark: Mark) {
  const at = sql`coalesce(${chatMessageTable.editedAt}, ${chatMessageTable.createdAt})`;
  const hash = md5(messageText);
  return db
    .select({
      sourceId: chatMessageTable.id,
      text: messageText,
      hash,
      stale: staleOf(hash),
      at: sql<string>`${at}::text`,
    })
    .from(chatMessageTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(
      semanticChunkTable,
      eq(semanticChunkTable.messageId, chatMessageTable.id),
    )
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        // Direct messages and channels with AI turned off are never embedded.
        isNull(chatChannelTable.directKey),
        aiEnabledChannel(),
        sql`length(trim(${chatMessageTable.body})) > 0`,
        afterMark(at, sql`${chatMessageTable.id}`, mark),
      ),
    )
    .orderBy(asc(at), asc(chatMessageTable.id))
    .limit(BATCH);
}

function changedTasks(workspaceId: string, mark: Mark) {
  const at = sql`coalesce(${taskTable.updatedAt}, ${taskTable.createdAt})`;
  const hash = md5(taskText);
  return db
    .select({
      sourceId: taskTable.id,
      text: taskText,
      hash,
      stale: staleOf(hash),
      at: sql<string>`${at}::text`,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(semanticChunkTable, eq(semanticChunkTable.taskId, taskTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        afterMark(at, sql`${taskTable.id}`, mark),
      ),
    )
    .orderBy(asc(at), asc(taskTable.id))
    .limit(BATCH);
}

function changedDocuments(workspaceId: string, mark: Mark) {
  const at = sql`coalesce(${documentTable.updatedAt}, ${documentTable.createdAt})`;
  const hash = md5(documentText);
  return db
    .select({
      sourceId: documentTable.id,
      text: documentText,
      hash,
      stale: staleOf(hash),
      at: sql<string>`${at}::text`,
    })
    .from(documentTable)
    .leftJoin(
      semanticChunkTable,
      eq(semanticChunkTable.documentId, documentTable.id),
    )
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        isNull(documentTable.deletedAt),
        afterMark(at, sql`${documentTable.id}`, mark),
      ),
    )
    .orderBy(asc(at), asc(documentTable.id))
    .limit(BATCH);
}

const CHANGED: Record<
  Kind,
  (workspaceId: string, mark: Mark) => Promise<Row[]>
> = {
  message: changedMessages,
  task: changedTasks,
  document: changedDocuments,
};

async function readMark(workspaceId: string, kind: Kind): Promise<Mark> {
  const [row] = await db
    .select({
      lastAt: semanticIndexStateTable.lastAt,
      lastId: semanticIndexStateTable.lastId,
    })
    .from(semanticIndexStateTable)
    .where(
      and(
        eq(semanticIndexStateTable.workspaceId, workspaceId),
        eq(semanticIndexStateTable.kind, kind),
      ),
    );
  return row ?? { lastAt: "-infinity", lastId: "" };
}

/** Embeds one batch of a kind changed since the mark; returns how many. */
async function indexKind(workspaceId: string, kind: Kind) {
  const rows = await CHANGED[kind](
    workspaceId,
    await readMark(workspaceId, kind),
  );
  const last = rows.at(-1);
  if (!last) return 0;
  const stale = rows.filter((row) => row.stale);
  const vectors = await embed(stale.map((row) => row.text));
  const column = COLUMN[kind];
  for (const [index, row] of stale.entries()) {
    const embedding = vectors[index] as number[];
    const indexedAt = new Date();
    await db
      .insert(semanticChunkTable)
      .values({
        workspaceId,
        [column]: row.sourceId,
        contentHash: row.hash,
        embedding,
        indexedAt,
      })
      .onConflictDoUpdate({
        target: semanticChunkTable[column],
        set: { contentHash: row.hash, embedding, indexedAt },
      });
  }
  const mark = { lastAt: last.at, lastId: last.sourceId };
  await db
    .insert(semanticIndexStateTable)
    .values({ workspaceId, kind, ...mark })
    .onConflictDoUpdate({
      target: [
        semanticIndexStateTable.workspaceId,
        semanticIndexStateTable.kind,
      ],
      set: mark,
    });
  return stale.length;
}

/** Forgets what was embedded from channels whose AI was turned off since. */
async function forgetAiDisabledChannels() {
  await db
    .delete(semanticChunkTable)
    .where(
      inArray(
        semanticChunkTable.messageId,
        db
          .select({ id: chatMessageTable.id })
          .from(chatMessageTable)
          .innerJoin(
            chatChannelTable,
            eq(chatChannelTable.id, chatMessageTable.channelId),
          )
          .where(eq(chatChannelTable.aiDisabled, true)),
      ),
    );
}

/**
 * Embeds what changed since the last run, a batch of each kind per
 * workspace that turned search by meaning on and may send its text out.
 * The scheduler runs it every minute; a new workspace backfills over its
 * first runs. Does nothing without the server key.
 */
export async function indexSemanticChunks() {
  if (!isSemanticSearchEnabled()) return { indexed: 0 };
  await forgetAiDisabledChannels();
  const workspaces = await db
    .select({ id: semanticSearchSettingTable.workspaceId })
    .from(semanticSearchSettingTable)
    .where(
      and(
        eq(semanticSearchSettingTable.enabled, true),
        workspaceIsActive(semanticSearchSettingTable.workspaceId),
      ),
    );
  let indexed = 0;
  for (const workspace of workspaces) {
    if (!(await embeddingEgressAllowed(workspace.id))) continue;
    for (const kind of Object.keys(COLUMN) as Kind[])
      indexed += await indexKind(workspace.id, kind);
  }
  return { indexed };
}
