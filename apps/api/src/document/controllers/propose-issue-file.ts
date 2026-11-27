import { createId } from "@paralleldrive/cuid2";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  documentFileTable,
  documentSubscriberTable,
  documentTable,
} from "../../database/schema";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import {
  copyToDocumentFile,
  isImageContentType,
  validateTaskAssetUploadInput,
} from "../../storage/s3";
import { filedOn } from "../../topic/controllers/file-document";
import { documentFileContentType, fileTypeRefused } from "../file-types";
import { fingerprint } from "../fingerprint";
import { audienceOf } from "./document-audience";
import { documentFileLine } from "./file-line";
import { getDocument } from "./get-document";
import {
  issueFileSource,
  loadIssueFile,
  proposalsOf,
  topicOfIssue,
} from "./issue-files";
import { notifyTopicFollowers } from "./notify";
import { recordVersion } from "./record-version";

/**
 * Who can open the file now, on its issue, and who could open the document it
 * becomes on the topic. Shown before the file is proposed, like any filing.
 */
export async function issueFileAudience(
  workspaceId: string,
  assetId: string,
  userId: string,
  topicId: string,
) {
  const file = await loadIssueFile(workspaceId, assetId, userId);
  const topic = await topicOfIssue(workspaceId, file.taskId, topicId, userId);
  const [current, proposed] = await Promise.all([
    audienceOf(workspaceId, {
      id: null,
      creatorId: null,
      scope: "issue",
      projectId: file.projectId,
      workProjectId: null,
      taskId: file.taskId,
    }),
    audienceOf(workspaceId, {
      id: null,
      creatorId: userId,
      scope: topic.scope,
      projectId: topic.projectId,
      workProjectId: topic.workProjectId,
      taskId: null,
    }),
  ]);
  return { current, proposed };
}

/**
 * Turns an issue's file into a proposal on a topic of that issue: a new
 * document in the topic's place that holds its own copy of the file. The issue
 * keeps its file, and deleting either leaves the other.
 */
export async function proposeIssueFile(
  workspaceId: string,
  assetId: string,
  userId: string,
  topicId: string,
  apiBaseUrl: string,
) {
  const file = await loadIssueFile(workspaceId, assetId, userId);
  const topic = await topicOfIssue(workspaceId, file.taskId, topicId, userId);
  // The rules an upload to a document passes. An issue takes more kinds of
  // file than a document does.
  const contentType = documentFileContentType(file.filename);
  if (!contentType) {
    throw new HTTPException(415, { message: fileTypeRefused });
  }
  try {
    validateTaskAssetUploadInput(contentType, file.size);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid file",
    });
  }
  const proposals = await proposalsOf(workspaceId, userId, [file.id]);
  if (proposals.some((proposal) => proposal.topicId === topic.id)) {
    throw new HTTPException(409, {
      message: "This file is already proposed on this topic.",
    });
  }

  const documentId = createId();
  const copyId = createId();
  let key: string;
  try {
    key = await copyToDocumentFile({
      sourceKey: file.objectKey,
      workspaceId,
      documentId,
      filename: file.filename,
      contentType,
    });
  } catch {
    throw new HTTPException(503, { message: "The file could not be copied." });
  }

  const image = isImageContentType(contentType);
  const title = file.filename.slice(0, 500);
  const content = documentFileLine({
    url: `${apiBaseUrl}/asset/${copyId}`,
    filename: file.filename,
    contentType,
    size: file.size,
  });
  try {
    await db.transaction(async (tx) => {
      await tx.insert(documentTable).values({
        id: documentId,
        workspaceId,
        title,
        content,
        fingerprint: fingerprint(content),
        ...filedOn(topic, userId),
        creatorId: userId,
        updatedById: userId,
      });
      await tx.insert(documentSubscriberTable).values({ documentId, userId });
      await recordVersion(
        documentId,
        userId,
        { title, content },
        { database: tx },
      );
      await tx.insert(assetTable).values({
        id: copyId,
        workspaceId,
        documentId,
        objectKey: key,
        filename: file.filename,
        mimeType: contentType,
        size: file.size,
        kind: image ? "image" : "attachment",
        surface: "document",
        createdBy: userId,
      });
      await tx.insert(documentFileTable).values({
        assetId: copyId,
        documentId,
        originalName: file.filename,
        sourceClient: "web",
        sourceUserId: userId,
        sourceUrl: issueFileSource(file.id),
      });
    });
  } catch (error) {
    // No row points at the copy, so nothing else would ever remove it.
    await queueStorageCleanup(db, [key]);
    throw error;
  }
  await notifyTopicFollowers(
    { id: documentId, workspaceId, title },
    topic.id,
    userId,
    "document_proposed",
  );
  return getDocument(workspaceId, documentId, userId);
}
