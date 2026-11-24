import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { formatDateMedium, formatRelativeTime } from "@/lib/format";
import { editedAfterApproval } from "./document-approval";

type TopicCurrentDocumentProps = { document: DocumentDetail };

/** The document a topic's readers rely on: who approved it, when and why. */
export function TopicCurrentDocument({ document }: TopicCurrentDocumentProps) {
  const { t } = useTranslation();
  return (
    <div className="mx-4 flex flex-col gap-1 rounded-lg border border-success/30 bg-success/4 px-4 py-3">
      <div className="flex items-center gap-2">
        <Link
          to="/dashboard/workspace/$workspaceId/document/$documentId"
          params={{
            workspaceId: document.workspaceId,
            documentId: document.id,
          }}
          className="min-w-0 truncate font-medium text-sm underline-offset-2 hover:underline"
        >
          {document.title || t("navigation:documents.untitled")}
        </Link>
        {editedAfterApproval(document) && (
          <Badge variant="warning" size="sm" className="shrink-0">
            {t("navigation:documents.banner.edited.lead")}
          </Badge>
        )}
      </div>
      {document.approvedAt && (
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.topics.approved", {
            name: document.approvedByName ?? "",
            date: formatDateMedium(document.approvedAt),
            age: formatRelativeTime(document.approvedAt),
          })}
        </p>
      )}
      {document.statusReason && (
        <p className="text-xs">
          {t("navigation:documents.topics.reason", {
            reason: document.statusReason,
          })}
        </p>
      )}
    </div>
  );
}
