import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

type DocumentReplaceIntentProps = {
  workspaceId: string;
  /** The document the proposal was filed to replace. */
  targetId: string;
  /** Its title, or null when the reader cannot open it. */
  title: string | null;
  /** The target is no longer the topic's current document. */
  stale: boolean;
};

/** What a proposal's author meant it to replace, and whether that still holds. */
export function DocumentReplaceIntent({
  workspaceId,
  targetId,
  title,
  stale,
}: DocumentReplaceIntentProps) {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs">
      <span>{t("navigation:documents.replaceIntent.lead")}</span>
      {title === null ? (
        <span>{t("navigation:documents.replaceIntent.hidden")}</span>
      ) : (
        <Link
          to="/dashboard/workspace/$workspaceId/document/$documentId"
          params={{ workspaceId, documentId: targetId }}
          className="truncate underline underline-offset-2"
        >
          {title}
        </Link>
      )}
      {stale && (
        <span className="font-medium text-warning-foreground">
          {t("navigation:documents.replaceIntent.stale")}
        </span>
      )}
    </span>
  );
}
