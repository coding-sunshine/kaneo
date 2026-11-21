import { ChevronRight, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FavoriteStar } from "@/components/common/favorite-star";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { DocumentOptionsMenu } from "./document-options-menu";
import { DocumentParentLink } from "./document-parent-link";

type DocumentCrumbsProps = {
  document: DocumentDetail;
  historyOpen: boolean;
  onRename: () => void;
  onShare: () => void;
  onToggleHistory: () => void;
};

/** Parent › document title, then the star and ··· menu. */
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
