import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  taskDuplicateDismissalTable,
  taskRelationTable,
  taskTable,
} from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { titleBodyVector } from "../search/fts";
import { taskIsUnfinished } from "../task/task-is-unfinished";
import { openTask } from "./open-task";
import { titleSimilarity, titleWords } from "./title-similarity";

export const SIMILARITY_THRESHOLD = 0.6;
const MAX_SUGGESTIONS = 3;
// Full-text candidates scored per request; recent tickets first.
const MAX_CANDIDATES = 200;

/**
 * Open tickets whose titles read like this one's, in teams the reader can
 * open. Tickets already related to it, and pairs someone declined, are left
 * out. Nothing is changed: accepting is an ordinary duplicate relation.
 */
export async function findDuplicateSuggestions(
  taskId: string,
  workspaceId: string,
  userId: string,
) {
  const task = await openTask(taskId, workspaceId, userId);
  const words = [...new Set(titleWords(task.title))]
    .filter((word) => word.length >= 3)
    .slice(0, 12);
  if (words.length === 0) return { suggestions: [] };
  // Words hold only letters and digits, so quoting them needs no escaping.
  const query = words.map((word) => `'${word}':*`).join(" | ");

  const [candidates, related, declined] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        projectId: taskTable.projectId,
        status: taskTable.status,
        number: taskTable.number,
        slug: projectTable.slug,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(
        and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
          ne(taskTable.id, taskId),
          ne(taskTable.status, "archived"),
          isNull(taskTable.archivedAt),
          taskIsUnfinished,
          projectAccessCondition(userId, projectTable.id),
          sql`${titleBodyVector(taskTable.title, taskTable.description)} @@ to_tsquery('simple', ${query})`,
        ),
      )
      .orderBy(desc(taskTable.createdAt))
      .limit(MAX_CANDIDATES),
    db
      .select({
        source: taskRelationTable.sourceTaskId,
        target: taskRelationTable.targetTaskId,
      })
      .from(taskRelationTable)
      .where(
        or(
          eq(taskRelationTable.sourceTaskId, taskId),
          eq(taskRelationTable.targetTaskId, taskId),
        ),
      ),
    db
      .select({
        low: taskDuplicateDismissalTable.lowTaskId,
        high: taskDuplicateDismissalTable.highTaskId,
      })
      .from(taskDuplicateDismissalTable)
      .where(
        or(
          eq(taskDuplicateDismissalTable.lowTaskId, taskId),
          eq(taskDuplicateDismissalTable.highTaskId, taskId),
        ),
      ),
  ]);
  const excluded = new Set([
    ...related.flatMap((row) => [row.source, row.target]),
    ...declined.flatMap((row) => [row.low, row.high]),
  ]);

  const suggestions = candidates
    .filter((candidate) => !excluded.has(candidate.id))
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      ticket: `${candidate.slug.toUpperCase()}-${candidate.number}`,
      projectId: candidate.projectId,
      status: candidate.status,
      similarity: titleSimilarity(task.title, candidate.title),
    }))
    .filter((candidate) => candidate.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_SUGGESTIONS);
  return { suggestions };
}
