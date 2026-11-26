import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentFact, MissingFact } from "@/fetchers/document/facts";
import { useAddDocumentFact } from "@/hooks/mutations/topic/use-fact-mutations";
import { toast } from "@/lib/toast";

type DocumentFactMissingProps = {
  document: { workspaceId: string; id: string };
  fact: MissingFact;
  /** The newest value somebody rejected for this fact. */
  rejected?: DocumentFact;
  canEdit: boolean;
};

/** A fact the text has no value for, with a form to add one by hand. */
export function DocumentFactMissing({
  document,
  fact,
  rejected,
  canEdit,
}: DocumentFactMissingProps) {
  const { t } = useTranslation();
  const add = useAddDocumentFact(document.workspaceId);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [quote, setQuote] = useState("");
  const valueId = useId();
  const quoteId = useId();
  const name = fact.slotName;

  const submit = () =>
    add.mutate(
      {
        workspaceId: document.workspaceId,
        id: document.id,
        slot: fact.slot,
        value: value.trim(),
        quote: quote.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("navigation:documents.facts.addDone"));
          setOpen(false);
          setValue("");
          setQuote("");
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/60 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate font-medium text-[13px]">{name}</p>
        {canEdit && !open && (
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            aria-label={t("navigation:documents.facts.addName", { name })}
            onClick={() => setOpen(true)}
          >
            {t("navigation:documents.facts.add")}
          </Button>
        )}
      </div>
      {rejected && (
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.facts.rejectedLine", {
            value: rejected.value,
            reason: rejected.statusReason,
          })}
        </p>
      )}
      {open && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={valueId}>
              {t("navigation:documents.facts.valueLabel")}
            </Label>
            <Input
              id={valueId}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {t(`navigation:documents.facts.valueHints.${fact.type}`)}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={quoteId}>
              {t("navigation:documents.facts.quoteLabel")}
            </Label>
            <Textarea
              id={quoteId}
              rows={2}
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {t("navigation:documents.facts.quoteHint")}
            </p>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              size="xs"
              disabled={
                !value.trim() || quote.trim().length < 4 || add.isPending
              }
              onClick={submit}
            >
              {t("navigation:documents.facts.addSubmit")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
