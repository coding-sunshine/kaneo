import type { DocumentFilter } from "@/fetchers/document/documents";
import type { ShortcutId } from "@/lib/shortcuts/catalog";

/** Linear's Documents tabs, in order, with the URL segment each one owns. */
export const DOCUMENT_TABS = [
  { filter: "recent", slug: null, shortcut: "documentsRecent" },
  { filter: "mine", slug: "my-documents", shortcut: "documentsMine" },
  { filter: "shared", slug: "shared-with-me", shortcut: "documentsShared" },
] as const satisfies readonly {
  filter: DocumentFilter;
  slug: string | null;
  shortcut: ShortcutId;
}[];

/** The filter a URL segment names; anything unknown falls back to Recent. */
export function documentFilterFromSlug(slug?: string): DocumentFilter {
  return DOCUMENT_TABS.find((tab) => tab.slug === slug)?.filter ?? "recent";
}
