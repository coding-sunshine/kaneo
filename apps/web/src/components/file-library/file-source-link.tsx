import { Link } from "@tanstack/react-router";
import { FileText, MessagesSquare, SquareCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LibraryFile } from "@/fetchers/file-library/get-files";

const LINK =
  "inline-flex min-w-0 items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline";

/** Where a file was added: its ticket, document or chat channel. */
export function FileSourceLink({
  workspaceId,
  source,
}: {
  workspaceId: string;
  source: LibraryFile["source"];
}) {
  const { t } = useTranslation();
  const label = (text: string) => <span className="truncate">{text}</span>;

  if (source.kind === "ticket" && source.projectId) {
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{ workspaceId, projectId: source.projectId, taskId: source.id }}
        className={LINK}
      >
        <SquareCheck aria-hidden="true" className="size-3.5 shrink-0" />
        {label(source.name)}
      </Link>
    );
  }
  if (source.kind === "document") {
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId, documentId: source.id }}
        className={LINK}
      >
        <FileText aria-hidden="true" className="size-3.5 shrink-0" />
        {label(source.name || t("navigation:files.untitled"))}
      </Link>
    );
  }
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/channels/$channelId"
      params={{ workspaceId, channelId: source.id }}
      search={{ messageId: source.messageId ?? undefined }}
      className={LINK}
    >
      <MessagesSquare aria-hidden="true" className="size-3.5 shrink-0" />
      {label(
        source.isDirect
          ? t("navigation:files.directMessage")
          : `#${source.name}`,
      )}
    </Link>
  );
}
