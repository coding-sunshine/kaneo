import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sectionRowClass } from "@/components/task/sections/section-row-class";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { formatRelativeTime } from "@/lib/format";
import { DocumentAccessLabel } from "./document-access-label";

type Props = {
  workspaceId: string;
  document: DocumentSummary;
  /** The issue this row is shown on: the link opens the document at its line. */
  taskId?: string;
};

/**
 * A document attached to an issue or linked in its text, listed under its
 * Resources like Linear. It says how far the document can be relied on, and a
 * replaced one points to the document that replaced it.
 */
export function DocumentResourceRow({ workspaceId, document, taskId }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId, documentId: document.id }}
        hash={taskId ? `issue-${taskId}` : undefined}
        className={`${sectionRowClass} flex-1 outline-none focus-visible:bg-accent`}
      >
        <FileText
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/85 group-hover:text-foreground">
          {document.title || t("navigation:documents.untitled")}
        </span>
        <DocumentAccessLabel
          scope={document.scope}
          parentName={document.parentName}
          className="max-w-32 shrink-0 text-xs"
        />
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
