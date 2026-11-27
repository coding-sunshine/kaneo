import { Link } from "@tanstack/react-router";
import { FileText, PinOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { formatRelativeTime } from "@/lib/format";
import { previewLines } from "./document-preview-lines";
import { occurrenceKeys } from "./occurrence-keys";

type PinnedDocumentCardProps = {
  document: DocumentDetail;
  onUnpin: () => void;
};

/** A pinned document as Linear shows it: title, last update, a tiny page. */
export function PinnedDocumentCard({
  document,
  onUnpin,
}: PinnedDocumentCardProps) {
  const { t } = useTranslation();
  const lines = previewLines(document.content);
  const keys = occurrenceKeys(lines.map((line) => line.text));
  return (
    <div className="group/card relative h-44 w-36 shrink-0">
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId: document.workspaceId, documentId: document.id }}
        className="flex h-full flex-col overflow-hidden rounded-md border border-border/70 bg-background p-3 shadow-xs outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FileText
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="mt-2 line-clamp-2 font-medium text-[13px] leading-4">
          {document.title || t("navigation:documents.untitled")}
        </span>
        <span className="mt-1 truncate text-[10px] text-muted-foreground">
          {t("navigation:documents.updated", {
            time: formatRelativeTime(document.updatedAt),
          })}
        </span>
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
          {lines.map((line, index) => (
            <p
              key={keys[index]}
              className={
                line.heading
                  ? "line-clamp-2 shrink-0 font-semibold text-[8px] leading-[11px]"
                  : "line-clamp-2 shrink-0 text-[7px] text-muted-foreground leading-[10px]"
              }
            >
              {line.text}
            </p>
          ))}
        </div>
      </Link>
      <button
        type="button"
        aria-label={t("navigation:documents.pins.unpin")}
        title={t("navigation:documents.pins.unpin")}
        onClick={onUnpin}
        className="absolute top-2 right-2 inline-flex size-6 items-center justify-center rounded-md bg-background text-muted-foreground opacity-0 outline-none hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/card:opacity-100"
      >
        <PinOff aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
