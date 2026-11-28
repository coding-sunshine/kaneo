import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { aiEnabledChannel } from "../assist/ai-allowed-channel";
import { readableChannel } from "../chat/readable-channel";
import db from "../database";
import {
  chatChannelTable,
  chatMessageTable,
  documentTable,
  projectTable,
  semanticChunkTable,
  taskTable,
} from "../database/schema";
import { documentVisibility } from "../document/visibility";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";
import { projectAccessCondition } from "../project-access/project-access-condition";

const MAX_RESULTS = 8;
// Below this cosine similarity a source is not about the question.
const MIN_SCORE = 0.3;

type Reader = { userId: string; workspaceId: string; mayReadTasks: boolean };

/**
 * The sources closest in meaning to `vector` that the reader can open now:
 * messages of channels they can read that are not marked no AI (never direct
 * messages), and, with the task permission, tickets of teams they can enter
 * and documents visible to them. Access is checked here, at read time.
 */
export async function findChunks(reader: Reader, vector: number[]) {
  const { userId, workspaceId, mayReadTasks } = reader;
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const query = `{${vector.map((value) => (Number.isFinite(value) ? value : 0)).join(",")}}`;
  const score =
    sql<number>`(select coalesce(sum(a * b), 0) from unnest(${semanticChunkTable.embedding}, ${query}::real[]) as pair(a, b))`.mapWith(
      Number,
    );
  const message = and(
    isNotNull(semanticChunkTable.messageId),
    eq(chatChannelTable.workspaceId, workspaceId),
    readableChannel(userId, workspaceId, guest),
    aiEnabledChannel(),
    isNull(chatChannelTable.directKey),
  );
  const task = and(
    isNotNull(semanticChunkTable.taskId),
    eq(projectTable.workspaceId, workspaceId),
    isNull(taskTable.archivedAt),
    projectAccessCondition(userId, projectTable.id),
  );
  const document = and(
    isNotNull(semanticChunkTable.documentId),
    eq(documentTable.workspaceId, workspaceId),
    isNull(documentTable.deletedAt),
    documentVisibility(userId, {
      id: documentTable.id,
      workspaceId: documentTable.workspaceId,
      creatorId: documentTable.creatorId,
      scope: documentTable.scope,
      projectId: documentTable.projectId,
      workProjectId: documentTable.workProjectId,
      taskId: documentTable.taskId,
    }),
  );
  const rows = await db
    .select({
      messageId: chatMessageTable.id,
      body: chatMessageTable.body,
      channelId: chatChannelTable.id,
      channelName: chatChannelTable.name,
      taskId: taskTable.id,
      taskTitle: taskTable.title,
      taskDescription: taskTable.description,
      documentId: documentTable.id,
      documentTitle: documentTable.title,
      documentContent: documentTable.content,
      score,
    })
    .from(semanticChunkTable)
    .leftJoin(
      chatMessageTable,
      eq(chatMessageTable.id, semanticChunkTable.messageId),
    )
    .leftJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(taskTable, eq(taskTable.id, semanticChunkTable.taskId))
    .leftJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(
      documentTable,
      eq(documentTable.id, semanticChunkTable.documentId),
    )
    .where(
      and(
        eq(semanticChunkTable.workspaceId, workspaceId),
        mayReadTasks ? or(message, task, document) : message,
      ),
    )
    .orderBy(desc(score))
    .limit(MAX_RESULTS);

  return rows
    .filter((row) => row.score >= MIN_SCORE)
    .map((row) =>
      row.messageId && row.channelId
        ? {
            kind: "message" as const,
            id: row.messageId,
            text: row.body ?? "",
            channelId: row.channelId,
            channelName: row.channelName ?? "",
          }
        : row.taskId
          ? {
              kind: "task" as const,
              id: row.taskId,
              text: `${row.taskTitle}\n${row.taskDescription ?? ""}`,
            }
          : {
              kind: "document" as const,
              id: row.documentId ?? "",
              text: `${row.documentTitle}\n${row.documentContent ?? ""}`,
            },
    );
}
