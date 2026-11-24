import { useTranslation } from "react-i18next";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { cn } from "@/lib/cn";

type DocumentStatusBannerProps = {
  document: Pick<DocumentDetail, "kind" | "status" | "sourceClient">;
};

const TONE: Record<DocumentDetail["status"], string> = {
  draft: "bg-muted/40 text-muted-foreground",
  in_review: "bg-info/8 text-info-foreground dark:bg-info/16",
  current: "bg-success/8 text-success-foreground dark:bg-success/16",
  superseded: "bg-warning/8 text-warning-foreground dark:bg-warning/16",
};

/** One line above the title: how far the reader may rely on this document. */
export function DocumentStatusBanner({ document }: DocumentStatusBannerProps) {
  const { t } = useTranslation();
  const { kind, status, sourceClient } = document;
  // A brainstorm that nobody filed for approval reads as options, not a draft
  // of a decision.
  const name = status === "draft" && kind === "brainstorm" ? kind : status;
  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-1.5 border-border/60 border-b px-4 py-1.5 text-xs",
        TONE[status],
      )}
    >
      <strong className="font-semibold">
        {t(`navigation:documents.banner.${name}.lead`)}
      </strong>
      <span>{t(`navigation:documents.banner.${name}.detail`)}</span>
      {sourceClient && sourceClient !== "web" && (
        <span className="ml-auto opacity-80">
          {t(`navigation:documents.savedFrom.${sourceClient}`)}
        </span>
      )}
    </div>
  );
}
