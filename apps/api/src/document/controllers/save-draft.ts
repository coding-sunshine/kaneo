import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import { documentSubscriberTable, documentTable } from "../../database/schema";
import { findTopics } from "../../topic/controllers/find-topics";
import type { saveDraftBody } from "../schema";
import { loadDocument } from "./load-document";
import { recordVersion } from "./record-version";

// What an assistant's tools save under: one draft per person and key.
const SOURCE = "mcp";

// The topics the author can open that the title seems to be about.
async function matchingTopics(
  workspaceId: string,
  userId: string,
  title: string,
) {
  const topics = await findTopics(workspaceId, userId, title);
  const currentIds = topics.flatMap((topic) => topic.currentDocumentId ?? []);
  // Everyone who can open a topic can open its current document.
  const current =
    currentIds.length === 0
      ? []
      : await db
          .select({
            id: documentTable.id,
            title: documentTable.title,
            approvedAt: documentTable.approvedAt,
          })
          .from(documentTable)
          .where(
            and(
              eq(documentTable.workspaceId, workspaceId),
              inArray(documentTable.id, currentIds),
            ),
          );
  return topics.map(({ id, name, parentName, currentDocumentId }) => ({
    id,
    name,
    parentName,
    currentDocument:
      current.find((doc) => doc.id === currentDocumentId) ?? null,
  }));
}

// Saves text an assistant sends as a private draft of the person it works
// for. A repeated call with the same key answers with the first draft, so a
// retry after a timeout does not save the text twice.
export async function saveDraft(
  userId: string,
  body: z.infer<typeof saveDraftBody>,
) {
  const { workspaceId, title, markdown } = body;
  const externalId = `${userId}:${body.idempotencyKey}`;
  // One transaction: a repeated call that arrives while this one runs waits
  // on the unique index, then finds the finished draft.
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(documentTable)
      .values({
        workspaceId,
        title,
        content: markdown,
        scope: "private",
        externalSource: SOURCE,
        externalId,
        sourceClient: body.sourceClient ?? null,
        creatorId: userId,
        updatedById: userId,
      })
      .onConflictDoNothing({
        target: [
          documentTable.workspaceId,
          documentTable.externalSource,
          documentTable.externalId,
        ],
      })
      .returning({ id: documentTable.id });
    if (!row) return null;
    // Like any new document: its author follows it and its history starts.
    await tx
      .insert(documentSubscriberTable)
      .values({ documentId: row.id, userId });
    await recordVersion(
      row.id,
      userId,
      { title, content: markdown },
      { database: tx },
    );
    return row;
  });

  let id = created?.id;
  if (!id) {
    const [existing] = await db
      .select({ id: documentTable.id, deletedAt: documentTable.deletedAt })
      .from(documentTable)
      .where(
        and(
          eq(documentTable.workspaceId, workspaceId),
          eq(documentTable.externalSource, SOURCE),
          eq(documentTable.externalId, externalId),
        ),
      );
    if (!existing) throw new Error("Draft insert returned no row");
    // The author threw it away. The same call must not bring it back.
    if (existing.deletedAt) {
      throw new HTTPException(409, {
        message:
          "The draft saved with this key was discarded. Use a new idempotency key to save the text again.",
      });
    }
    id = existing.id;
  }

  const doc = await loadDocument(workspaceId, id, userId);
  return {
    id,
    title: doc.title,
    characters: doc.content.length,
    kind: doc.kind,
    status: doc.status,
    scope: doc.scope,
    created: Boolean(created),
    needsDecision: doc.status === "draft" && doc.kind === "unsorted",
    topics: await matchingTopics(workspaceId, userId, doc.title),
  };
}
