import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { DocumentAccessLabel } from "./document-access-label";
import { STATUS_TONE } from "./document-status-tone";

type DocumentListProps = {
  workspaceId: string;
  documents: DocumentSummary[];
  /** Controls at the end of a row, outside the link that opens it. */
  action?: (document: DocumentSummary) => ReactNode;
};

/**
 * One row per document: title, status, where it lives, owner, last update.
 * A phone keeps the title and the time; the rest would cut the title short.
 */
export function DocumentList({
  workspaceId,
  documents,
  action,
}: DocumentListProps) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex items-center border-border/60 border-b"
        >
          <Link
            to="/dashboard/workspace/$workspaceId/document/$documentId"
            params={{ workspaceId, documentId: document.id }}
            className="flex h-11 min-w-0 flex-1 items-center gap-3 px-4 text-[13px] outline-none hover:bg-accent/50 focus-visible:bg-accent/50"
          >
            <FileText
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {document.title || t("navigation:documents.untitled")}
            </span>
            <Badge
              variant={STATUS_TONE[document.status]}
              size="sm"
              className="hidden shrink-0 sm:inline-flex"
            >
              {t(`navigation:documents.status.${document.status}`)}
            </Badge>
            <DocumentAccessLabel
              scope={document.scope}
              parentName={document.parentName}
              className="hidden max-w-48 shrink-0 sm:inline-flex"
            />
            <Avatar
              className="hidden size-5 shrink-0 sm:block"
              title={document.creatorName ?? ""}
            >
              <AvatarImage src={document.creatorImage ?? ""} alt="" />
              <AvatarFallback className="bg-muted font-semibold text-[9px]">
                {getInitials(document.creatorName)}
              </AvatarFallback>
            </Avatar>
            <time
              dateTime={String(document.updatedAt)}
              className="shrink-0 text-right text-muted-foreground sm:w-24"
            >
              {formatRelativeTime(document.updatedAt)}
            </time>
          </Link>
          {action && (
            <div className="flex shrink-0 items-center gap-2 pe-3 text-[13px]">
              {action(document)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
