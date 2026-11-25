import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { documentTable } from "../../database/schema";
import { fileDocument } from "../../topic/controllers/file-document";
import { slotsOf } from "../../topic/controllers/slots";
import {
  proposeStatements,
  type SentStatement,
} from "../../topic/controllers/statements";
import type { settleDocumentBody } from "../schema";
import { deleteDocument } from "./delete-document";
import { loadDocument } from "./load-document";
import { updateDocument } from "./update-document";

type Settled = Pick<
  typeof documentTable.$inferSelect,
  "title" | "kind" | "status" | "scope" | "topicId" | "supersedesDocumentId"
>;

// The author's answer for a draft: file it on a topic, keep it as a
// brainstorm, or throw it away. No answer makes a document current. Only the
// topic's decider or the workspace owner can do that.
export async function settleDocument(
  workspaceId: string,
  id: string,
  userId: string,
  { choice, topicId, statements = [] }: z.infer<typeof settleDocumentBody>,
) {
  const draft = await loadDocument(workspaceId, id, userId, { need: "owner" });
  if (draft.status !== "draft") {
    throw new HTTPException(409, {
      message: "This document is already filed on a topic",
    });
  }
  const receipt = (
    doc: Settled,
    discarded = false,
    stated: Awaited<ReturnType<typeof proposeStatements>> = [],
  ) => ({
    id,
    choice,
    title: doc.title,
    kind: doc.kind,
    status: doc.status,
    scope: doc.scope,
    topicId: doc.topicId,
    replacesDocumentId: doc.supersedesDocumentId,
    discarded,
    statements: stated,
  });

  if (choice === "discard") {
    await deleteDocument(workspaceId, id, userId);
    return receipt(draft, true);
  }
  if (choice === "brainstorm") {
    return receipt(
      await updateDocument(workspaceId, id, userId, { kind: "brainstorm" }),
    );
  }
  // The hosted MCP endpoint passes only each field's rule, so the rule that
  // filing needs a topic is checked here and not in the request schema.
  if (!topicId) {
    throw new HTTPException(400, {
      message: "Name the topic to file the document on",
    });
  }
  const filedDocument = await fileDocument(
    workspaceId,
    topicId,
    id,
    userId,
    choice === "replace",
  );
  return receipt(
    filedDocument,
    false,
    await stateFor(draft, filedDocument.topicId, statements, userId),
  );
}

// The statements an assistant sends with the filing. Filing leaves the text
// as it was, so the draft loaded above still holds it.
async function stateFor(
  draft: Awaited<ReturnType<typeof loadDocument>>,
  topicId: string | null,
  statements: SentStatement[],
  userId: string,
) {
  if (!topicId || statements.length === 0) return [];
  const slots = (await slotsOf([topicId])).get(topicId) ?? [];
  return proposeStatements(draft, slots, statements, "assistant", userId);
}
