import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { useDocumentReceipt } from "@/hooks/queries/topic/use-facts";
import { openConflicts, waitingCount } from "./fact-groups";

type DocumentFactsHintProps = {
  document: Pick<DocumentDetail, "workspaceId" | "id" | "topicId">;
  canConfirm: boolean;
  onOpen: () => void;
};

/** One line under the status: facts that conflict or wait for a person. */
export function DocumentFactsHint({
  document,
  canConfirm,
  onOpen,
}: DocumentFactsHintProps) {
  const { t } = useTranslation();
  const { data } = useDocumentReceipt(
    document.workspaceId,
    document.topicId ? document.id : null,
  );
  if (!data) return null;

  const conflicts = openConflicts(data);
  const waiting = canConfirm ? waitingCount(data) : 0;
  if (!conflicts && !waiting) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-border/60 border-b px-4 py-1.5 text-muted-foreground text-xs">
      <div
        role="note"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5"
      >
        {conflicts > 0 && (
          <span>
            {t("navigation:documents.facts.hint.conflicts", {
              count: conflicts,
            })}
          </span>
        )}
        {waiting > 0 && (
          <span>
            {t("navigation:documents.facts.hint.waiting", { count: waiting })}
          </span>
        )}
      </div>
      <Button
        size="xs"
        variant="outline"
        className="ml-auto shrink-0"
        onClick={onOpen}
      >
        {t("navigation:documents.facts.hint.review")}
      </Button>
    </div>
  );
}
