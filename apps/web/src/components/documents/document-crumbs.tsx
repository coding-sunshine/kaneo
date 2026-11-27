import { ChevronRight, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FavoriteStar } from "@/components/common/favorite-star";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { DocumentAccessLabel } from "./document-access-label";
import { DocumentOptionsMenu } from "./document-options-menu";
import { DocumentParentLink } from "./document-parent-link";
import { PageAncestorCrumbs } from "./page-tree/page-ancestor-crumbs";

type DocumentCrumbsProps = {
  document: DocumentDetail;
  historyOpen: boolean;
  onRename: () => void;
  onShare: () => void;
  onToggleHistory: () => void;
};

/** Place › pages above › document title, then the star and ··· menu. */
export function DocumentCrumbs({
  document,
  historyOpen,
  onRename,
  onShare,
  onToggleHistory,
}: DocumentCrumbsProps) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("navigation:documents.title")}
      className="flex min-w-0 items-center gap-0.5"
    >
      <DocumentParentLink document={document} />
      <PageAncestorCrumbs
        workspaceId={document.workspaceId}
        ancestors={document.ancestors}
      />
      <ChevronRight
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="flex min-w-0 items-center gap-1.5 px-1 text-xs">
        <FileText
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="truncate">
          {document.title || t("navigation:documents.untitled")}
        </span>
        <DocumentAccessLabel scope={document.scope} className="text-xs" />
      </span>
      <FavoriteStar
        workspaceId={document.workspaceId}
        target={{ type: "document", targetId: document.id }}
      />
      <DocumentOptionsMenu
        document={document}
        historyOpen={historyOpen}
        onRename={onRename}
        onShare={onShare}
        onToggleHistory={onToggleHistory}
      />
    </nav>
  );
}
