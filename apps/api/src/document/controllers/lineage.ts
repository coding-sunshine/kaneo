import { and, desc, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  type DocumentLineageStatus,
  documentLineageTable,
  documentTable,
} from "../../database/schema";
import { fingerprint, resemblance } from "../fingerprint";
import { documentVisibility } from "../visibility";
import { loadDocument } from "./load-document";

// A text that shares this much of all five-word runs with an older document
// looks like a revision of it. Decided at 0.30: of a ten-sentence plan, one
// sentence rewritten shares 0.76, two 0.56-0.60, three 0.41-0.45, four
// 0.28-0.31, five 0.20 and six 0.16. So a revision with up to three of ten
// sentences new is named, and at four it depends on the words.
const THRESHOLD = 0.3;
// Documents that nobody edited for this long are not compared.
const WINDOW_MS = 90 * 86_400_000;

type Written = Pick<
  typeof documentTable.$inferSelect,
  "id" | "workspaceId" | "createdAt"
>;

/**
 * Proposes the older document that a text which was just written resembles,
 * among the documents its writer can open. `prints` is the fingerprint the
 * writer stored with the text. A link that a person confirmed or dismissed is
 * left alone, and so is a proposal whose source the writer cannot open: the
 * comparison runs as the writer, and what they cannot see says nothing about
 * it.
 */
export async function proposeLineage(
  doc: Written,
  prints: number[],
  userId: string,
) {
  const [link] = await db
    .select({
      status: documentLineageTable.status,
      sourceVisible: documentVisibility(userId, documentTable),
    })
    .from(documentLineageTable)
    .innerJoin(
      documentTable,
      eq(documentTable.id, documentLineageTable.sourceDocumentId),
    )
    .where(eq(documentLineageTable.documentId, doc.id));
  if (link && (link.status !== "proposed" || !link.sourceVisible)) return;

  // ponytail: every save of an undecided text loads the fingerprints of the
  // recent documents of a similar length and compares them here. That holds at
  // this team's volume. Move the comparison into SQL (intarray) when a save
  // gets slow.
  const candidates =
    prints.length === 0
      ? []
      : await db
          .select({
            id: documentTable.id,
            fingerprint: documentTable.fingerprint,
            contentHash: documentTable.contentHash,
            // Only of a row whose text was written past the API.
            content: sql<
              string | null
            >`CASE WHEN ${documentTable.fingerprint} IS NULL THEN ${documentTable.content} END`,
          })
          .from(documentTable)
          .where(
            and(
              eq(documentTable.workspaceId, doc.workspaceId),
              ne(documentTable.id, doc.id),
              isNull(documentTable.deletedAt),
              // An older document is never a revision of a newer one.
              lt(documentTable.createdAt, doc.createdAt),
              gt(documentTable.updatedAt, new Date(Date.now() - WINDOW_MS)),
              documentVisibility(userId, documentTable),
              // Two texts cannot share THRESHOLD of all runs when one is
              // more than 1 / THRESHOLD times as long as the other.
              or(
                isNull(documentTable.fingerprint),
                sql`cardinality(${documentTable.fingerprint}) BETWEEN ${Math.ceil(prints.length * THRESHOLD)} AND ${Math.floor(prints.length / THRESHOLD)}`,
              ),
            ),
          )
          // Of two equally close documents, the one edited last.
          .orderBy(desc(documentTable.updatedAt));

  let best: { id: string; overlap: number } | undefined;
  for (const candidate of candidates) {
    let theirs = candidate.fingerprint;
    if (!theirs) {
      theirs = fingerprint(candidate.content ?? "");
      // Kept for the next comparison, unless the text changed meanwhile.
      await db
        .update(documentTable)
        .set({ fingerprint: theirs })
        .where(
          and(
            eq(documentTable.id, candidate.id),
            isNull(documentTable.fingerprint),
            candidate.contentHash === null
              ? isNull(documentTable.contentHash)
              : eq(documentTable.contentHash, candidate.contentHash),
          ),
        );
    }
    const overlap = resemblance(prints, theirs);
    if (overlap >= THRESHOLD && overlap > (best?.overlap ?? 0)) {
      best = { id: candidate.id, overlap };
    }
  }

  if (!best) {
    await db
      .delete(documentLineageTable)
      .where(
        and(
          eq(documentLineageTable.documentId, doc.id),
          eq(documentLineageTable.status, "proposed"),
        ),
      );
    return;
  }
  const proposal = {
    sourceDocumentId: best.id,
    // Rounded down, so 100 means the same words.
    overlap: Math.floor(best.overlap * 100),
  };
  await db
    .insert(documentLineageTable)
    .values({ documentId: doc.id, ...proposal })
    .onConflictDoUpdate({
      target: documentLineageTable.documentId,
      set: proposal,
      // Not over a decision that arrived in between.
      setWhere: eq(documentLineageTable.status, "proposed"),
    });
}

/**
 * The document this one looks like a revision of, for a reader who can open
 * that document. Anybody else gets no link, as if there were none.
 */
export async function readLineage(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const source = alias(documentTable, "lineage_source");
  const [link] = await db
    .select({
      id: source.id,
      title: source.title,
      overlap: documentLineageTable.overlap,
      status: documentLineageTable.status,
    })
    .from(documentLineageTable)
    .innerJoin(source, eq(source.id, documentLineageTable.sourceDocumentId))
    .where(
      and(
        eq(documentLineageTable.documentId, id),
        eq(source.workspaceId, workspaceId),
        isNull(source.deletedAt),
        documentVisibility(userId, source),
      ),
    );
  return link ?? null;
}

/**
 * Records what a person says about the proposed link. It can be said again the
 * other way, and it changes nothing else about either document.
 */
export async function decideLineage(
  workspaceId: string,
  id: string,
  userId: string,
  status: Exclude<DocumentLineageStatus, "proposed">,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit" });
  // No link and a link to a document the person cannot open answer alike.
  if (!(await readLineage(workspaceId, id, userId))) {
    throw new HTTPException(404, {
      message: "This document has no link to another document",
    });
  }
  await db
    .update(documentLineageTable)
    .set({ status, decidedBy: userId, decidedAt: new Date() })
    .where(eq(documentLineageTable.documentId, id));
}
