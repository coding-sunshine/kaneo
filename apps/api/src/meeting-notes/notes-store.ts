import { and, desc, eq } from "drizzle-orm";
import db from "../database";
import { meetingNotesRunTable } from "../database/schema";
import { loadDocument } from "../document/controllers/load-document";

/** The caller's latest kept run on a document they can still open, or null. */
export async function latestKeptRun(
  workspaceId: string,
  documentId: string,
  userId: string,
) {
  await loadDocument(workspaceId, documentId, userId);
  const [row] = await db
    .select({
      id: meetingNotesRunTable.id,
      proposal: meetingNotesRunTable.proposal,
      createdAt: meetingNotesRunTable.createdAt,
    })
    .from(meetingNotesRunTable)
    .where(
      and(
        eq(meetingNotesRunTable.workspaceId, workspaceId),
        eq(meetingNotesRunTable.documentId, documentId),
        eq(meetingNotesRunTable.userId, userId),
      ),
    )
    .orderBy(desc(meetingNotesRunTable.createdAt))
    .limit(1);
  return {
    run: row
      ? {
          runId: row.id,
          ...row.proposal,
          createdAt: row.createdAt.toISOString(),
        }
      : null,
  };
}
