import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sectionRowClass } from "@/components/task/sections/section-row-class";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { formatRelativeTime } from "@/lib/format";

type Props = { workspaceId: string; document: DocumentSummary };

/**
 * A document attached to an issue or linked in its text, listed under its
 * Resources like Linear. It says how far the document can be relied on, and a
 * replaced one points to the document that replaced it.
 */
export function DocumentResourceRow({ workspaceId, document }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId, documentId: document.id }}
        className={`${sectionRowClass} flex-1 outline-none focus-visible:bg-accent`}
      >
        <FileText
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/85 group-hover:text-foreground">
          {document.title || t("navigation:documents.untitled")}
        </span>
        <span className="shrink-0 text-muted-foreground text-xs">
          {t(`navigation:documents.status.${document.status}`)}
        </span>
        <time
          dateTime={String(document.updatedAt)}
          className="shrink-0 text-muted-foreground text-xs"
        >
          {formatRelativeTime(document.updatedAt)}
        </time>
      </Link>
      {document.currentDocumentId && (
        <Link
          to="/dashboard/workspace/$workspaceId/document/$documentId"
          params={{ workspaceId, documentId: document.currentDocumentId }}
          className="shrink-0 rounded-md px-2 py-1 text-info-foreground text-xs underline underline-offset-2 outline-none focus-visible:bg-accent"
        >
          {t("navigation:documents.banner.openCurrent")}
        </Link>
      )}
    </div>
  );
}
