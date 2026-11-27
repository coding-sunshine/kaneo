import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  receiptTicketTable,
  topicTable,
} from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import createTask from "../../task/controllers/create-task";
import { receiptOf } from "./receipt";
import { openTopic } from "./statements";
import { suggestionsOf } from "./suggested-tickets";

const notFound = () =>
  new HTTPException(404, { message: "Suggestion not found" });

// The team the ticket goes to: the topic's own, else the one the person
// names. A team they cannot enter answers like one that does not exist.
async function ticketTeam(
  workspaceId: string,
  topicId: string,
  userId: string,
  named: string | undefined,
) {
  const [topic] = await db
    .select({ projectId: topicTable.projectId })
    .from(topicTable)
    .where(eq(topicTable.id, topicId));
  const projectId = topic?.projectId ?? named;
  if (!projectId) {
    throw new HTTPException(400, {
      message: "The topic has no team: name the team the ticket goes to.",
    });
  }
  const [team] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    );
  if (!team) throw new HTTPException(404, { message: "Team not found" });
  return team.id;
}

/**
 * Makes the ticket a document's receipt suggests, once. The suggestion is
 * looked up in the receipt as the person sees it, so its text never comes
 * from the request.
 */
export async function acceptSuggestedTicket(
  workspaceId: string,
  documentId: string,
  key: string,
  userId: string,
  body: { projectId?: string },
) {
  const doc = await loadDocument(workspaceId, documentId, userId);
  const topicId = await openTopic(doc, userId);
  if (!topicId) throw notFound();
  const receipt = await receiptOf(db, doc, topicId, userId);
  const suggestion = (await suggestionsOf(db, doc, receipt)).find(
    (s) => s.key === key,
  );
  if (!suggestion) throw notFound();
  const projectId = await ticketTeam(
    workspaceId,
    topicId,
    userId,
    body.projectId,
  );

  // The claim goes in first: two accepts at once make one ticket.
  const [claim] = await db
    .insert(receiptTicketTable)
    .values({ documentId: doc.id, suggestionKey: key, acceptedBy: userId })
    .onConflictDoNothing()
    .returning();
  if (!claim) {
    throw new HTTPException(409, {
      message: "This suggestion is already a ticket.",
    });
  }
  const release = () =>
    db
      .delete(receiptTicketTable)
      .where(
        and(
          eq(receiptTicketTable.documentId, doc.id),
          eq(receiptTicketTable.suggestionKey, key),
        ),
      );
  let task: Awaited<ReturnType<typeof createTask>>;
  try {
    task = await createTask({
      projectId,
      currentUserId: userId,
      title: suggestion.title,
      description: suggestion.description,
      status: "",
      topicId,
    });
  } catch (error) {
    await release();
    throw error;
  }
  if (!task) {
    await release();
    throw new HTTPException(500, { message: "The ticket was not made" });
  }
  await db
    .update(receiptTicketTable)
    .set({ taskId: task.id })
    .where(
      and(
        eq(receiptTicketTable.documentId, doc.id),
        eq(receiptTicketTable.suggestionKey, key),
      ),
    );
  return { key, taskId: task.id };
}
