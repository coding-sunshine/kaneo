import { eq } from "drizzle-orm";
import db from "../../database";
import { documentCollabStateTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { loadDocument } from "../controllers/load-document";
import {
  documentChanged,
  isDocumentChanged,
  writeDocument,
} from "../controllers/update-document";
import { assertCoeditingOn } from "./coediting-config";

// Two co-editors' saves can cross; the loser goes again on the new text.
const ATTEMPTS = 3;

/**
 * Saves the Markdown of the co-edited state. Co-editors all hold the same
 * merged text, so they save over each other freely. A text written outside
 * co-editing since stops them, until one of them has reviewed it and sends
 * its hash as `baseHash`.
 */
export async function saveCoeditedText(
  workspaceId: string,
  documentId: string,
  userId: string,
  body: { content: string; baseHash?: string },
) {
  assertCoeditingOn();
  for (let attempt = 1; ; attempt += 1) {
    const doc = await loadDocument(workspaceId, documentId, userId, {
      need: "edit",
    });
    const [row] = await db
      .select({ seededHash: documentCollabStateTable.seededHash })
      .from(documentCollabStateTable)
      .where(eq(documentCollabStateTable.documentId, documentId));
    if (!row) {
      throw new ApiError(409, {
        code: "COEDIT_NOT_SEEDED",
        message: "This document has no co-editing state yet: seed it first",
      });
    }
    const reviewed = body.baseHash !== undefined;
    if (!reviewed && row.seededHash !== (doc.contentHash ?? ""))
      documentChanged();
    try {
      return await writeDocument(
        doc,
        userId,
        { content: body.content, baseHash: body.baseHash ?? row.seededHash },
        { coedited: true },
      );
    } catch (error) {
      if (reviewed || !isDocumentChanged(error) || attempt >= ATTEMPTS)
        throw error;
    }
  }
}
