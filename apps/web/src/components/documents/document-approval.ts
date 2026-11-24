import type { DocumentDetail } from "@/fetchers/document/documents";

/**
 * A current document whose text is no longer the text that was approved. It
 * reads as "Edited after approval" until someone who decides approves again.
 */
export function editedAfterApproval(
  document: Pick<DocumentDetail, "status" | "contentHash" | "approvedHash">,
) {
  return (
    document.status === "current" &&
    document.approvedHash !== null &&
    document.contentHash !== document.approvedHash
  );
}
