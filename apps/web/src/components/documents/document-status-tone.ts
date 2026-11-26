import type { DocumentSummary } from "@/fetchers/document/documents";

/** Badge variant for where a document stands. */
export const STATUS_TONE = {
  draft: "outline",
  in_review: "info",
  current: "success",
  superseded: "warning",
} as const satisfies Record<DocumentSummary["status"], string>;
