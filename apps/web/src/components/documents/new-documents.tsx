import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  type DocumentSummary,
  markDocumentsSeen,
} from "@/fetchers/document/documents";
import { useNewDocuments } from "@/hooks/queries/document/use-documents";
import { DocumentList } from "./document-list";

// When the document became news: its approval, or its filing as a proposal.
const changedAt = (document: DocumentSummary) =>
  document.status === "current" ? document.approvedAt : document.filedAt;

/**
 * Proposals and new current documents on the topics this person follows,
 * since they last opened the page. Showing them is the visit: the newest
 * time on the list is recorded, so a change that lands later is still new.
 */
export function NewDocuments({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: documents } = useNewDocuments(workspaceId);

  useEffect(() => {
    const latest = documents?.map(changedAt).sort().at(-1);
    // A failure only means the same documents are listed again next time.
    if (latest) markDocumentsSeen(workspaceId, latest).catch(() => {});
  }, [workspaceId, documents]);

  if (!documents?.length) return null;
  return (
    <section
      aria-labelledby="documents-new"
      className="shrink-0 border-border/60 border-b"
    >
      <h2
        id="documents-new"
        className="px-4 pt-3 pb-1 text-muted-foreground text-xs"
      >
        {t("navigation:documents.newSinceVisit")}
      </h2>
      <DocumentList workspaceId={workspaceId} documents={documents} />
    </section>
  );
}
