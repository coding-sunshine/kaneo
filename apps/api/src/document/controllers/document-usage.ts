import { and, count, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { isWorkspaceOwner } from "../../topic/controllers/get-topic";
import { CHAT_SOURCE } from "./save-draft";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 4;

// The only numbers that count documents the reader cannot open, so they go to
// workspace owners alone and carry no title, topic or person. A week is seven
// days back from now, and the first one is the newest. Documents in the trash
// are not counted.
export async function documentUsage(workspaceId: string, userId: string) {
  if (!(await isWorkspaceOwner(workspaceId, userId))) {
    throw new HTTPException(403, {
      message: "Only a workspace owner can see document usage",
    });
  }
  const now = Date.now();
  const weeks = Array.from({ length: WEEKS }, (_, index) => ({
    from: new Date(now - (index + 1) * WEEK),
    to: new Date(now - index * WEEK),
    added: 0,
    filed: 0,
    chatSaves: 0,
  }));
  const [[topics], documents] = await Promise.all([
    // A topic has at most one current document, so these are topics.
    db
      .select({ withCurrent: count() })
      .from(documentTable)
      .where(
        and(
          eq(documentTable.workspaceId, workspaceId),
          eq(documentTable.status, "current"),
          isNotNull(documentTable.topicId),
          isNull(documentTable.deletedAt),
        ),
      ),
    // ponytail: one row per document of four weeks, counted here. Count in
    // SQL if a workspace ever adds more than a few thousand a month.
    db
      .select({
        createdAt: documentTable.createdAt,
        filedAt: documentTable.filedAt,
        externalSource: documentTable.externalSource,
      })
      .from(documentTable)
      .where(
        and(
          eq(documentTable.workspaceId, workspaceId),
          isNull(documentTable.deletedAt),
          gte(documentTable.createdAt, new Date(now - WEEKS * WEEK)),
        ),
      ),
  ]);
  for (const document of documents) {
    // The database clock can run ahead of this one and date a document after
    // `now`. That document was added this week.
    const age = Math.max(0, now - document.createdAt.getTime());
    const week = weeks[Math.floor(age / WEEK)];
    if (!week) continue;
    week.added += 1;
    if (document.filedAt) week.filed += 1;
    if (document.externalSource === CHAT_SOURCE) week.chatSaves += 1;
  }
  return { topicsWithCurrent: topics?.withCurrent ?? 0, weeks };
}
