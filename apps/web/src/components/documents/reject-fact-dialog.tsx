import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRejectDocumentFact } from "@/hooks/mutations/topic/use-fact-mutations";
import { toast } from "@/lib/toast";

export type RejectFactDialogProps = {
  workspaceId: string;
  documentId: string;
  fact: { statementId: string; slotName: string; value: string };
  onClose: () => void;
};

/** Drops one value from a document, with the reason. */
export function RejectFactDialog({
  workspaceId,
  documentId,
  fact,
  onClose,
}: RejectFactDialogProps) {
  const { t } = useTranslation();
  const reject = useRejectDocumentFact(workspaceId);
  const [reason, setReason] = useState("");

  const submit = () =>
    reject.mutate(
      {
        workspaceId,
        id: documentId,
        statementId: fact.statementId,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("navigation:documents.facts.rejectDone"));
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
            {t("navigation:documents.facts.rejectTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("navigation:documents.facts.rejectHint", {
              name: fact.slotName,
              value: fact.value,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Label className="flex-col items-start gap-1.5">
            {t("navigation:documents.facts.reasonLabel")}
            <Textarea
              autoFocus
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
            variant="destructive"
            size="sm"
            disabled={!reason.trim() || reject.isPending}
            onClick={submit}
          >
            {t("navigation:documents.facts.rejectSubmit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
