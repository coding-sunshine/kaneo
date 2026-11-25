import { eq } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { createDocument } from "../../document/controllers/create-document";
import { loadDocument } from "../../document/controllers/load-document";
import { writeDocument } from "../../document/controllers/update-document";
import { addDecisionLine } from "../decision-line";
import type { recordDecisionBody } from "../schema";
import { makeCurrent, notDecider } from "./decide";
import { filedOn } from "./file-document";
import { getTopic } from "./get-topic";

// A decision made outside any document, written down by someone who decides
// on the topic. With no current document, the note becomes it. Otherwise the
// decision goes into the current document as a dated line, and the document
// reads as edited after approval until the line is approved like any edit.
export async function recordDecision(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof recordDecisionBody>,
) {
  const topic = await getTopic(workspaceId, id, userId);
  if (!topic.canDecide) throw notDecider();
  const day = body.date ?? new Date().toISOString().slice(0, 10);
  const line = `- ${day}: ${body.text.replace(/\s+/g, " ")}`;

  if (topic.currentDocumentId) {
    // Deciding on the topic is the right to add this one line, whatever the
    // document lets the person edit. They must still be able to open it.
    const doc = await loadDocument(
      workspaceId,
      topic.currentDocumentId,
      userId,
    );
    // ponytail: the last write wins, as for every edit of a document.
    return writeDocument(doc, userId, {
      content: addDecisionLine(doc.content, line),
    });
  }

  const note = await createDocument(userId, {
    workspaceId,
    title: topic.name,
    content: addDecisionLine("", line),
  });
  // Put on the topic here and not filed as a proposal, so the topic's
  // followers hear of it once, when it is current.
  await db
    .update(documentTable)
    .set({ ...filedOn(topic), kind: "decision" })
    .where(eq(documentTable.id, note.id));
  // ponytail: two first decisions at the same moment make two notes, and the
  // later one replaces the earlier. Lock the topic row if that ever happens.
  return makeCurrent(workspaceId, id, note.id, userId, body.reason);
}
