import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentVersion } from "@/fetchers/document/documents";
import { useDocumentVersions } from "@/hooks/queries/document/use-documents";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

type DocumentHistoryProps = {
  workspaceId: string;
  documentId: string;
  selectedId: string | null;
  onSelect: (version: DocumentVersion | null) => void;
  onClose: () => void;
};

/** Linear's document history rail: newest version first, pick one to view. */
export function DocumentHistory({
  workspaceId,
  documentId,
  selectedId,
  onSelect,
  onClose,
}: DocumentHistoryProps) {
  const { t } = useTranslation();
  const { data: versions = [], isLoading } = useDocumentVersions(
    workspaceId,
    documentId,
    true,
  );

  return (
    <aside
      aria-label={t("navigation:documents.history.title")}
      className="flex w-72 shrink-0 flex-col border-border/60 border-l"
    >
      <div className="flex h-11 items-center justify-between px-4">
        <h2 className="font-medium text-[13px]">
          {t("navigation:documents.history.title")}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("navigation:documents.history.close")}
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              "w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent/60",
              selectedId === null && "bg-accent",
            )}
          >
            {t("navigation:documents.history.current")}
          </button>
        </li>
        {versions.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              onClick={() => onSelect(version)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left hover:bg-accent/60",
                selectedId === version.id && "bg-accent",
              )}
            >
              <span className="block text-[13px]">
                {formatDateTime(version.updatedAt)}
              </span>
              <span className="block text-muted-foreground text-xs">
                {version.authorName}
              </span>
            </button>
          </li>
        ))}
        {!isLoading && versions.length === 0 && (
          <li className="px-2 py-1.5 text-muted-foreground text-xs">
            {t("navigation:documents.history.empty")}
          </li>
        )}
      </ul>
    </aside>
  );
}
