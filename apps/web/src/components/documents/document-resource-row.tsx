import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sectionRowClass } from "@/components/task/sections/section-row-class";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { formatRelativeTime } from "@/lib/format";

type Props = { workspaceId: string; document: DocumentSummary };

/** A document attached to an issue, listed under its Resources like Linear. */
export function DocumentResourceRow({ workspaceId, document }: Props) {
  const { t } = useTranslation();
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/document/$documentId"
      params={{ workspaceId, documentId: document.id }}
      className={`${sectionRowClass} outline-none focus-visible:bg-accent`}
    >
      <FileText
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/85 group-hover:text-foreground">
        {document.title || t("navigation:documents.untitled")}
      </span>
      <time
        dateTime={String(document.updatedAt)}
        className="shrink-0 text-muted-foreground text-xs"
      >
        {formatRelativeTime(document.updatedAt)}
      </time>
    </Link>
  );
}
