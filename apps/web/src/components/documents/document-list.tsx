import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";

type DocumentListProps = {
  workspaceId: string;
  documents: DocumentSummary[];
};

/** One row per document: title, where it lives, owner and last update. */
export function DocumentList({ workspaceId, documents }: DocumentListProps) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col">
      {documents.map((document) => (
        <li key={document.id}>
          <Link
            to="/dashboard/workspace/$workspaceId/document/$documentId"
            params={{ workspaceId, documentId: document.id }}
            className="flex h-11 items-center gap-3 border-border/60 border-b px-4 text-[13px] outline-none hover:bg-accent/50 focus-visible:bg-accent/50"
          >
            <FileText
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {document.title || t("navigation:documents.untitled")}
            </span>
            {document.parentName && (
              <span className="hidden max-w-48 truncate text-muted-foreground sm:block">
                {document.parentName}
              </span>
            )}
            <Avatar
              className="size-5 shrink-0"
              title={document.creatorName ?? ""}
            >
              <AvatarImage src={document.creatorImage ?? ""} alt="" />
              <AvatarFallback className="bg-muted font-semibold text-[9px]">
                {getInitials(document.creatorName)}
              </AvatarFallback>
            </Avatar>
            <time
              dateTime={String(document.updatedAt)}
              className="w-24 shrink-0 text-right text-muted-foreground"
            >
              {formatRelativeTime(document.updatedAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
