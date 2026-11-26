import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { ConflictDecision, FactConflict } from "@/fetchers/document/facts";
import { useDecideDocumentConflict } from "@/hooks/mutations/topic/use-fact-mutations";
import { toast } from "@/lib/toast";
import { localDay } from "./local-day";

type DecideConflictDialogProps = {
  workspaceId: string;
  documentId: string;
  conflict: Pick<FactConflict, "id" | "slotName" | "value" | "current">;
  onClose: () => void;
};

const OPTIONS: ConflictDecision[] = ["replace", "keep", "tolerate", "dismiss"];

/** The decider's answer to "Which holds?", with its reason. */
export function DecideConflictDialog({
  workspaceId,
  documentId,
  conflict,
  onClose,
}: DecideConflictDialogProps) {
  const { t } = useTranslation();
  const decide = useDecideDocumentConflict(workspaceId);
  const labelId = useId();
  const [decision, setDecision] = useState<ConflictDecision | null>(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const tolerating = decision === "tolerate";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const submit = () =>
    decision &&
    decide.mutate(
      {
        workspaceId,
        id: documentId,
        conflictId: conflict.id,
        decision,
        reason: reason.trim(),
        tolerateUntil: tolerating
          ? new Date(`${date}T23:59:59`).toISOString()
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("navigation:documents.facts.conflict.done"));
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t("navigation:documents.facts.conflict.title", {
              name: conflict.slotName,
            })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted-foreground">
              {t("navigation:documents.facts.conflict.thisDocument")}
            </dt>
            <dd className="min-w-0 break-words">{conflict.value}</dd>
            <dt className="text-muted-foreground">
              {t("navigation:documents.facts.conflict.current", {
                title:
                  conflict.current.documentTitle ||
                  t("navigation:documents.untitled"),
              })}
            </dt>
            <dd className="min-w-0 break-words">{conflict.current.value}</dd>
          </dl>
          <span id={labelId} className="font-medium text-sm">
            {t("navigation:documents.facts.conflict.choice")}
          </span>
          <RadioGroup
            aria-labelledby={labelId}
            value={decision ?? ""}
            onValueChange={(value) => setDecision(value as ConflictDecision)}
          >
            {OPTIONS.map((option) => (
              <Label key={option} className="items-start">
                <Radio value={option} className="mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px]">
                    {t(`navigation:documents.facts.conflict.options.${option}`)}
                  </span>
                  <span className="font-normal text-muted-foreground text-xs">
                    {t(
                      `navigation:documents.facts.conflict.optionHints.${option}`,
                    )}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          {tolerating && (
            <Label className="flex-col items-start gap-1.5">
              {t("navigation:documents.facts.conflict.until")}
              <Input
                type="date"
                value={date}
                min={localDay(tomorrow)}
                onChange={(event) => setDate(event.target.value)}
              />
            </Label>
          )}
          <Label className="flex-col items-start gap-1.5">
            {t("navigation:documents.facts.reasonLabel")}
            <Textarea
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
            />
          </Label>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={
              !decision ||
              !reason.trim() ||
              (tolerating && !date) ||
              decide.isPending
            }
            onClick={submit}
          >
            {t("navigation:documents.facts.conflict.submit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
