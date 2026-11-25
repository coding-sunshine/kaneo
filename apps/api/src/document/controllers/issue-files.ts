import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  documentFileTable,
  documentTable,
  projectTable,
  taskTable,
  taskTopicTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import {
  isAttachment,
  notDraft,
} from "../../task/controllers/task-attachments";
import { getTopic, listTopics } from "../../topic/controllers/get-topic";
import { documentVisibility } from "../visibility";

// An issue's file is open to whoever can open the issue. Every read of issue
// files joins the asset to its issue and the issue's team and applies this
// rule, so a file in a team the person cannot enter, a pasted image, a draft
// upload and a document's own file all answer like a file that does not exist.
const openTo = (workspaceId: string, userId: string) =>
  and(
    eq(projectTable.workspaceId, workspaceId),
    isAttachment,
    notDraft,
    projectAccessCondition(userId, projectTable.id),
  );

/** What a document made from an issue's file records as where it came from. */
export const issueFileSource = (assetId: string) => `/api/asset/${assetId}`;

// The documents made from these files that the person can open. One they
// cannot open is not counted: saying it exists would name a hidden document.
export const proposalsOf = (
  workspaceId: string,
  userId: string,
  assetIds: string[],
) =>
  db
    .select({
      source: documentFileTable.sourceUrl,
      documentId: documentTable.id,
      topicId: documentTable.topicId,
    })
    .from(documentFileTable)
    .innerJoin(
      documentTable,
      eq(documentTable.id, documentFileTable.documentId),
    )
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        isNull(documentTable.deletedAt),
        inArray(documentFileTable.sourceUrl, assetIds.map(issueFileSource)),
        documentVisibility(userId, documentTable),
      ),
    );

export async function loadIssueFile(
  workspaceId: string,
  assetId: string,
  userId: string,
) {
  const [file] = await db
    .select({
      id: assetTable.id,
      objectKey: assetTable.objectKey,
      filename: assetTable.filename,
      size: assetTable.size,
      taskId: taskTable.id,
      projectId: projectTable.id,
    })
    .from(assetTable)
    .innerJoin(taskTable, eq(taskTable.id, assetTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(and(eq(assetTable.id, assetId), openTo(workspaceId, userId)));
  if (!file) throw new HTTPException(404, { message: "File not found" });
  return file;
}

// A file is proposed on a topic its issue is on. A topic the person cannot
// open, one the issue is not on and one that does not exist answer the same.
export async function topicOfIssue(
  workspaceId: string,
  taskId: string,
  topicId: string,
  userId: string,
) {
  const topic = await getTopic(workspaceId, topicId, userId);
  const [link] = await db
    .select({ topicId: taskTopicTable.topicId })
    .from(taskTopicTable)
    .where(
      and(
        eq(taskTopicTable.taskId, taskId),
        eq(taskTopicTable.topicId, topicId),
      ),
    );
  if (!link) throw new HTTPException(404, { message: "Topic not found" });
  return topic;
}

/**
 * The files on issues the person can open, each with its issue and the topics
 * of that issue they can open. They are reference material, not proposals:
 * none is a document until someone proposes it.
 */
export async function listIssueFiles(
  workspaceId: string,
  userId: string,
  topicId: string | undefined,
  apiBaseUrl: string,
) {
  if (topicId) await getTopic(workspaceId, topicId, userId);
  const files = await db
    .select({
      id: assetTable.id,
      filename: assetTable.filename,
      mimeType: assetTable.mimeType,
      size: assetTable.size,
      createdAt: assetTable.createdAt,
      taskId: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      projectId: projectTable.id,
      projectSlug: projectTable.slug,
    })
    .from(assetTable)
    .innerJoin(taskTable, eq(taskTable.id, assetTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        openTo(workspaceId, userId),
        topicId
          ? inArray(
              taskTable.id,
              db
                .select({ id: taskTopicTable.taskId })
                .from(taskTopicTable)
                .where(eq(taskTopicTable.topicId, topicId)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(assetTable.createdAt), desc(assetTable.id))
    // ponytail: the newest 200, no paging. Add a cursor when a workspace
    // holds more issue files than that.
    .limit(200);
  if (!files.length) return [];

  const [topics, links, proposals] = await Promise.all([
    listTopics(workspaceId, userId),
    db
      .select()
      .from(taskTopicTable)
      .where(
        inArray(taskTopicTable.taskId, [
          ...new Set(files.map((file) => file.taskId)),
        ]),
      ),
    proposalsOf(
      workspaceId,
      userId,
      files.map((file) => file.id),
    ),
  ]);
  const open = new Map(topics.map((topic) => [topic.id, topic.name]));

  return files.map(
    ({ taskId, title, number, projectId, projectSlug, ...file }) => ({
      ...file,
      url: `${apiBaseUrl}/asset/${file.id}`,
      task: { id: taskId, title, number, projectId, projectSlug },
      topics: links.flatMap((link) => {
        const name = open.get(link.topicId);
        if (link.taskId !== taskId || name === undefined) return [];
        const made = proposals.find(
          (proposal) =>
            proposal.topicId === link.topicId &&
            proposal.source === issueFileSource(file.id),
        );
        return [
          {
            id: link.topicId,
            name,
            proposedDocumentId: made?.documentId ?? null,
          },
        ];
      }),
    }),
  );
}
