import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type DocumentReplaceIntentProps = {
  workspaceId: string;
  /** The document the proposal was filed to replace. */
  targetId: string;
  /** Its title, or null when the reader cannot open it. */
  title: string | null;
  /** The target is no longer the topic's current document. */
  stale: boolean;
  /** In a list row: one line that truncates, the lead hidden on a phone. */
  compact?: boolean;
};

/** What a proposal's author meant it to replace, and whether that still holds. */
export function DocumentReplaceIntent({
  workspaceId,
  targetId,
  title,
  stale,
  compact = false,
}: DocumentReplaceIntentProps) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-x-1 text-xs",
        compact ? "max-w-36 flex-nowrap sm:max-w-96" : "flex-wrap",
      )}
    >
      <span className={cn("shrink-0", compact && "hidden sm:inline")}>
        {t("navigation:documents.replaceIntent.lead")}
      </span>
      {title === null ? (
        <span>{t("navigation:documents.replaceIntent.hidden")}</span>
      ) : (
        <Link
          to="/dashboard/workspace/$workspaceId/document/$documentId"
          params={{ workspaceId, documentId: targetId }}
          className="min-w-0 truncate underline underline-offset-2"
        >
          {title}
        </Link>
      )}
      {stale && (
        <span
          className={cn(
            "font-medium text-warning-foreground",
            compact && "min-w-0 truncate",
          )}
          title={t("navigation:documents.replaceIntent.stale")}
        >
          {t("navigation:documents.replaceIntent.stale")}
        </span>
      )}
    </span>
  );
}
