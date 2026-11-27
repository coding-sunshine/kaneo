import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  projectTable,
  receiptTicketTable,
  statementConflictTable,
  taskTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import type { Reader } from "./current-statements";
import type { receiptOf } from "./receipt";

type Receipt = Awaited<ReturnType<typeof receiptOf>>;
type Doc = { id: string; title: string };

// Names the slot, the document and the value: an edit elsewhere in the text
// keeps it, a new value makes another suggestion.
const suggestionKey = (slotId: string, documentId: string, value: string) =>
  createHash("sha256")
    .update(JSON.stringify([slotId, documentId, value]))
    .digest("hex");

/**
 * One ticket per change the receipt shows: a value that differs from the
 * current document, and a fact the current document does not state. A pair
 * the decider called no conflict asks for no work.
 */
export async function suggestionsOf(
  database: Reader,
  doc: Doc,
  receipt: Receipt,
) {
  const dismissed = new Set(
    (
      await database
        .select({ pairHash: statementConflictTable.pairHash })
        .from(statementConflictTable)
        .where(
          and(
            eq(statementConflictTable.documentId, doc.id),
            eq(statementConflictTable.decision, "dismiss"),
          ),
        )
    ).map((row) => row.pairHash),
  );
  const description = (quote: string) =>
    `From the document "${doc.title}": "${quote}"`;
  const changes = receipt.conflicts
    .filter((conflict) => !dismissed.has(conflict.id))
    .map((conflict) => ({
      key: suggestionKey(conflict.slotId, doc.id, conflict.value),
      kind: "change" as const,
      slot: conflict.slot,
      slotName: conflict.slotName,
      value: conflict.value,
      previousValue: conflict.current.value as string | null,
      title: `Change ${conflict.slotName} from ${conflict.current.value} to ${conflict.value}`,
      description: description(conflict.quote),
    }));
  const added = receipt.new.map((stated) => ({
    key: suggestionKey(stated.slotId, doc.id, stated.value),
    kind: "new" as const,
    slot: stated.slot,
    slotName: stated.slotName,
    value: stated.value,
    previousValue: null,
    title: `Record ${stated.slotName}: ${stated.value}`,
    description: description(stated.quote),
  }));
  return [...changes, ...added].sort((a, b) => a.slot.localeCompare(b.slot));
}

/**
 * The suggestions with whether each became a ticket. A ticket in a team the
 * viewer cannot enter shows as taken, and nothing of it shows.
 */
export async function suggestedTickets(
  database: Reader,
  doc: Doc,
  receipt: Receipt,
  viewerId: string,
) {
  const suggestions = await suggestionsOf(database, doc, receipt);
  if (suggestions.length === 0) return [];
  const taken = await database
    .select({
      key: receiptTicketTable.suggestionKey,
      taskId: receiptTicketTable.taskId,
    })
    .from(receiptTicketTable)
    .where(
      and(
        eq(receiptTicketTable.documentId, doc.id),
        inArray(
          receiptTicketTable.suggestionKey,
          suggestions.map((s) => s.key),
        ),
      ),
    );
  const taskIds = taken.flatMap((row) => row.taskId ?? []);
  const tickets = new Map(
    (taskIds.length === 0
      ? []
      : await database
          .select({
            id: taskTable.id,
            number: taskTable.number,
            projectId: taskTable.projectId,
          })
          .from(taskTable)
          .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
          .where(
            and(
              inArray(taskTable.id, taskIds),
              projectAccessCondition(viewerId, projectTable.id),
            ),
          )
    ).map((task) => [task.id, task]),
  );
  const takenBy = new Map(taken.map((row) => [row.key, row.taskId]));
  return suggestions.map(({ description: _, ...suggestion }) => {
    const taskId = takenBy.get(suggestion.key);
    return {
      ...suggestion,
      accepted: takenBy.has(suggestion.key),
      ticket: (taskId && tickets.get(taskId)) || null,
    };
  });
}
