import type { DocumentFilter } from "@/fetchers/document/documents";
import type { ShortcutId } from "@/lib/shortcuts/catalog";

/** A tab is a document filter, or one of two lists the documents API does not know. */
export type DocumentTabKey = DocumentFilter | "issueFiles" | "needsReview";

/**
 * The Documents tabs, in order, with the URL segment each one owns. The first
 * three are Linear's; the next two hold what no topic holds yet; then the
 * files on issues, and the work that rests on a replaced value.
 */
export const DOCUMENT_TABS = [
  { filter: "recent", slug: null, shortcut: "documentsRecent" },
  { filter: "mine", slug: "my-documents", shortcut: "documentsMine" },
  { filter: "shared", slug: "shared-with-me", shortcut: "documentsShared" },
  { filter: "unfiled", slug: "not-yet-filed", shortcut: "documentsUnfiled" },
  { filter: "inbox", slug: "inbox", shortcut: "documentsInbox" },
  {
    filter: "issueFiles",
    slug: "issue-files",
    shortcut: "documentsIssueFiles",
  },
  {
    filter: "needsReview",
    slug: "needs-review",
    shortcut: "documentsNeedsReview",
  },
] as const satisfies readonly {
  filter: DocumentTabKey;
  slug: string | null;
  shortcut: ShortcutId;
}[];

/** The tab a URL segment names; anything unknown falls back to Recent. */
export function documentTabFromSlug(slug?: string): DocumentTabKey {
  return DOCUMENT_TABS.find((tab) => tab.slug === slug)?.filter ?? "recent";
}
