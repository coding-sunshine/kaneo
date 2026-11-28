import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { aiEnabledChannel } from "../assist/ai-allowed-channel";
import { embed, isSemanticSearchEnabled } from "../assist/embeddings";
import db from "../database";
import {
  chatChannelTable,
  chatMessageTable,
  documentTable,
  projectTable,
  semanticChunkTable,
  taskTable,
} from "../database/schema";
import { documentText, md5, messageText, taskText } from "./source-text";

const BATCH = 64;

type Pending = {
  workspaceId: string;
  sourceId: string;
  text: string;
  hash: string;
};
type Column = "messageId" | "taskId" | "documentId";

// No embedding yet, or one of older text.
const stale = (hash: ReturnType<typeof md5>) =>
  or(isNull(semanticChunkTable.id), ne(semanticChunkTable.contentHash, hash));

async function pendingMessages() {
  const hash = md5(messageText);
  return db
    .select({
      workspaceId: chatChannelTable.workspaceId,
      sourceId: chatMessageTable.id,
      text: messageText,
      hash,
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
        // Direct messages and channels marked no AI are never embedded.
        isNull(chatChannelTable.directKey),
        aiEnabledChannel(),
        sql`length(trim(${chatMessageTable.body})) > 0`,
        stale(hash),
      ),
    )
    .limit(BATCH);
}

async function pendingTasks() {
  const hash = md5(taskText);
  return db
    .select({
      workspaceId: projectTable.workspaceId,
      sourceId: taskTable.id,
      text: taskText,
      hash,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(semanticChunkTable, eq(semanticChunkTable.taskId, taskTable.id))
    .where(stale(hash))
    .limit(BATCH);
}

async function pendingDocuments() {
  const hash = md5(documentText);
  return db
    .select({
      workspaceId: documentTable.workspaceId,
      sourceId: documentTable.id,
      text: documentText,
      hash,
    })
    .from(documentTable)
    .leftJoin(
      semanticChunkTable,
      eq(semanticChunkTable.documentId, documentTable.id),
    )
    .where(and(isNull(documentTable.deletedAt), stale(hash)))
    .limit(BATCH);
}

async function store(column: Column, rows: Pending[]) {
  if (rows.length === 0) return 0;
  const vectors = await embed(rows.map((row) => row.text));
  for (const [index, row] of rows.entries()) {
    const embedding = vectors[index] as number[];
    await db
      .insert(semanticChunkTable)
      .values({
        workspaceId: row.workspaceId,
        [column]: row.sourceId,
        contentHash: row.hash,
        embedding,
      })
      .onConflictDoUpdate({
        target: semanticChunkTable[column],
        set: { contentHash: row.hash, embedding },
      });
  }
  return rows.length;
}

/**
 * Embeds sources that are new or changed since their last embedding, a batch
 * of each kind per run; the scheduler runs it every minute, which is also the
 * one-time backfill of an existing install. Does nothing when off.
 */
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

export async function indexSemanticChunks() {
  if (!isSemanticSearchEnabled()) return { indexed: 0 };
  await forgetAiDisabledChannels();
  const indexed =
    (await store("messageId", await pendingMessages())) +
    (await store("taskId", await pendingTasks())) +
    (await store("documentId", await pendingDocuments()));
  return { indexed };
}
