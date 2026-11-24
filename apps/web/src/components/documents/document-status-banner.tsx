import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { cn } from "@/lib/cn";
import { formatDateMedium, formatRelativeTime } from "@/lib/format";
import { editedAfterApproval } from "./document-approval";

export type BannerDocument = Pick<
  DocumentDetail,
  | "workspaceId"
  | "id"
  | "kind"
  | "status"
  | "sourceClient"
  | "topicId"
  | "topicName"
  | "contentHash"
  | "approvedHash"
  | "approvedAt"
  | "confirmedAt"
  | "statusReason"
>;

type DocumentStatusBannerProps = {
  document: BannerDocument;
  /** The document the topic relies on today, for a reader who may open the topic. */
  currentDocumentId?: string | null;
  /** What this reader may do next: file it, approve it, confirm it. */
  actions?: ReactNode;
};

const TONE: Record<DocumentDetail["status"], string> = {
  draft: "bg-muted/40 text-muted-foreground",
  in_review: "bg-info/8 text-info-foreground dark:bg-info/16",
  current: "bg-success/8 text-success-foreground dark:bg-success/16",
  superseded: "bg-warning/8 text-warning-foreground dark:bg-warning/16",
};
const LINK = "underline underline-offset-2";

/** One line above the title: how far the reader may rely on this document. */
export function DocumentStatusBanner({
  document,
  currentDocumentId,
  actions,
}: DocumentStatusBannerProps) {
  const { t } = useTranslation();
  const { workspaceId, kind, status, sourceClient, approvedAt, confirmedAt } =
    document;
  const edited = editedAfterApproval(document);
  // A brainstorm that nobody filed for approval reads as options, not a draft
  // of a decision.
  const name = edited
    ? "edited"
    : status === "draft" && kind === "brainstorm"
      ? kind
      : status;
  // A share-only reader gets no topic: the plain wording stands in.
  const approved = status === "current" && !edited && approvedAt;
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-border/60 border-b px-4 py-1.5 text-xs",
        edited ? TONE.superseded : TONE[status],
      )}
    >
      <div
        role="status"
        className="flex min-w-0 flex-wrap items-center gap-x-1.5"
      >
        <strong className="font-semibold">
          {t(`navigation:documents.banner.${name}.lead`)}
        </strong>
        {approved ? (
          <span>
            {t("navigation:documents.banner.current.approved", {
              date: formatDateMedium(approved),
              age: formatRelativeTime(approved),
            })}
          </span>
        ) : (
          <span>{t(`navigation:documents.banner.${name}.detail`)}</span>
        )}
        {approved && confirmedAt && (
          <span>
            {t("navigation:documents.banner.current.confirmed", {
              date: formatDateMedium(confirmedAt),
            })}
          </span>
        )}
        {status === "superseded" && document.statusReason && (
          <span>
            {t("navigation:documents.banner.reason", {
              reason: document.statusReason,
            })}
          </span>
        )}
        {document.topicId && (
          <Link
            to="/dashboard/workspace/$workspaceId/topic/$topicId"
            params={{ workspaceId, topicId: document.topicId }}
            className={LINK}
          >
            {t("navigation:documents.banner.topic", {
              name: document.topicName ?? "",
            })}
          </Link>
        )}
        {currentDocumentId && currentDocumentId !== document.id && (
          <Link
            to="/dashboard/workspace/$workspaceId/document/$documentId"
            params={{ workspaceId, documentId: currentDocumentId }}
            className={LINK}
          >
            {t("navigation:documents.banner.openCurrent")}
          </Link>
        )}
        {sourceClient && sourceClient !== "web" && (
          <span className="opacity-80">
            {t(`navigation:documents.savedFrom.${sourceClient}`)}
          </span>
        )}
      </div>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
