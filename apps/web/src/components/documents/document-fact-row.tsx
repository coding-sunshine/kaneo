import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ComparedFact,
  DocumentFact,
  StatedFact,
} from "@/fetchers/document/facts";

type DocumentFactRowProps = {
  fact: StatedFact | ComparedFact;
  /** The same value as the document's own list has it, for who and how. */
  detail?: DocumentFact;
  /** Show what the current document says (the unjudged group). */
  showCurrent?: boolean;
  canConfirm: boolean;
  pending: boolean;
  onConfirm: () => void;
  onReject: () => void;
};

/** One value read from this document's text. */
export function DocumentFactRow({
  fact,
  detail,
  showCurrent,
  canConfirm,
  pending,
  onConfirm,
  onReject,
}: DocumentFactRowProps) {
  const { t } = useTranslation();
  const name = fact.slotName;
  const who = fact.confirmed
    ? detail?.decidedByName &&
      t("navigation:documents.facts.confirmedBy", {
        name: detail.decidedByName,
      })
    : detail && t(`navigation:documents.facts.source.${detail.source}`);

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate font-medium text-[13px]">{name}</p>
        <Badge variant="outline" size="sm" className="ml-auto">
          {fact.confirmed
            ? t("navigation:documents.facts.status.confirmed")
            : t("navigation:documents.facts.status.proposed")}
        </Badge>
      </div>
      <p className="text-[13px]">{fact.value}</p>
      <q className="text-muted-foreground text-xs">{fact.quote}</q>
      {who && <p className="text-muted-foreground text-xs">{who}</p>}
      {showCurrent && "current" in fact && (
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.facts.currentValue", {
            value: fact.current.value,
          })}
        </p>
      )}
      {canConfirm && (
        <div className="flex gap-1.5 pt-0.5">
          {!fact.confirmed && (
            <Button
              size="xs"
              variant="outline"
              disabled={pending}
              aria-label={t("navigation:documents.facts.confirmName", { name })}
              onClick={onConfirm}
            >
              {t("navigation:documents.facts.confirm")}
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            aria-label={t("navigation:documents.facts.rejectName", { name })}
            onClick={onReject}
          >
            {t("navigation:documents.facts.reject")}
          </Button>
        </div>
      )}
    </div>
  );
}
