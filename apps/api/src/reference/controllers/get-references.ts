import { and, asc, desc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelTable,
  chatMessageTable,
  documentTable,
  projectTable,
  type ReferencePlace,
  referenceTable,
  taskTable,
} from "../../database/schema";
import { readableChannel } from "../../chat/readable-channel";
import { documentVisibility } from "../../document/visibility";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { projectAccessCondition } from "../../project-access/project-access-condition";

export type ReferenceTarget =
  | { taskId: string }
  | { documentId: string }
  | { projectId: string };

type Row = {
  id: string;
  title: string;
  key: string | null;
  projectId: string | null;
  place: ReferencePlace;
};

const targetCondition = (target: ReferenceTarget) =>
  "taskId" in target
    ? eq(referenceTable.targetTaskId, target.taskId)
    : "documentId" in target
      ? eq(referenceTable.targetDocumentId, target.documentId)
      : eq(referenceTable.targetProjectId, target.projectId);

// One entry per source, with every place it names the target in.
function bySource(kind: "task" | "document", rows: Row[]) {
  const sources = new Map<string, Row & { places: ReferencePlace[] }>();
  for (const row of rows) {
    const source = sources.get(row.id);
    if (source) source.places.push(row.place);
    else sources.set(row.id, { ...row, places: [row.place] });
  }
  return [...sources.values()].map(({ id, title, key, projectId, places }) => ({
    kind,
    id,
    title,
    key,
    projectId,
    places: places.sort(),
  }));
}

/**
 * The tickets, documents and chat messages of a workspace whose text names
 * the target, only those the reader can open: a hidden source, or a message
 * in a channel the reader cannot read, never shows through a reference.
 * The caller has checked that the reader may open the target.
 */
export async function getReferences(
  workspaceId: string,
  target: ReferenceTarget,
  userId: string,
) {
  const where = and(
    eq(referenceTable.workspaceId, workspaceId),
    targetCondition(target),
  );
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const [tasks, documents, messages] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        projectId: taskTable.projectId,
        slug: projectTable.slug,
        number: taskTable.number,
        place: referenceTable.place,
      })
      .from(referenceTable)
      .innerJoin(taskTable, eq(taskTable.id, referenceTable.sourceTaskId))
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(
        and(
          where,
          eq(projectTable.workspaceId, workspaceId),
          projectAccessCondition(userId, projectTable.id),
        ),
      )
      .orderBy(
        asc(projectTable.slug),
        asc(taskTable.number),
        asc(referenceTable.place),
      ),
    db
      .select({
        id: documentTable.id,
        title: documentTable.title,
        place: referenceTable.place,
      })
      .from(referenceTable)
      .innerJoin(
        documentTable,
        eq(documentTable.id, referenceTable.sourceDocumentId),
      )
      .where(
        and(
          where,
          eq(documentTable.workspaceId, workspaceId),
          isNull(documentTable.deletedAt),
          documentVisibility(userId, documentTable),
        ),
      )
      .orderBy(asc(documentTable.title), asc(documentTable.id)),
    db
      .select({
        id: chatMessageTable.id,
        title: chatChannelTable.name,
        channelId: chatChannelTable.id,
      })
      .from(referenceTable)
      .innerJoin(
        chatMessageTable,
        eq(chatMessageTable.id, referenceTable.sourceMessageId),
      )
      .innerJoin(
        chatChannelTable,
        eq(chatChannelTable.id, chatMessageTable.channelId),
      )
      .where(
        and(
          where,
          eq(chatChannelTable.workspaceId, workspaceId),
          readableChannel(userId, workspaceId, guest),
        ),
      )
      .orderBy(desc(chatMessageTable.createdAt), asc(chatMessageTable.id)),
  ]);
  return {
    references: [
      ...bySource(
        "task",
        tasks.map(({ slug, number, ...row }) => ({
          ...row,
          key: number === null ? null : `${slug.toUpperCase()}-${number}`,
        })),
      ),
      ...bySource(
        "document",
        documents.map((row) => ({ ...row, key: null, projectId: null })),
      ),
      ...messages.map((row) => ({
        kind: "message" as const,
        ...row,
        key: null,
        projectId: null,
        places: ["chat" as const],
      })),
    ],
  };
}
