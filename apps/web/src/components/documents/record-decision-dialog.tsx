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
import { Textarea } from "@/components/ui/textarea";
import type { Topic, recordTopicDecision } from "@/fetchers/topic/topics";
import { useRecordTopicDecision } from "@/hooks/mutations/topic/use-topic-mutations";
import { toast } from "@/lib/toast";
import { editedAfterApproval } from "./document-approval";
import { localDay } from "./local-day";

export type RecordedDecision = Awaited<ReturnType<typeof recordTopicDecision>>;

type RecordDecisionDialogProps = {
  topic: Pick<Topic, "id" | "workspaceId" | "name" | "currentDocumentId">;
  onClose: () => void;
  onApprove: (document: RecordedDecision, reason: string) => void;
};

/**
 * Writes down what was decided and why. With no current document the note
 * becomes one; otherwise it is added to the current document, which then
 * waits for the decider's approval.
 */
export function RecordDecisionDialog({
  topic,
  onClose,
  onApprove,
}: RecordDecisionDialogProps) {
  const { t } = useTranslation();
  const record = useRecordTopicDecision(topic.workspaceId);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");

  const submit = () =>
    record.mutate(
      {
        id: topic.id,
        text: text.trim(),
        reason: reason.trim(),
        date: localDay(),
      },
      {
        onSuccess: (document) => {
          if (editedAfterApproval(document)) {
            onApprove(document, reason.trim());
            return;
          }
          toast.success(t("navigation:documents.decision.done"));
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.decision.title")}</DialogTitle>
          <DialogDescription>
            {t(
              topic.currentDocumentId
                ? "navigation:documents.decision.hintAdd"
                : "navigation:documents.decision.hintStart",
              { topic: topic.name },
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">
              {t("navigation:documents.decision.textLabel")}
            </span>
            <Textarea
              value={text}
              maxLength={1000}
              rows={2}
              placeholder={t("navigation:documents.decision.textPlaceholder")}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">
              {t("navigation:documents.decision.reasonLabel")}
            </span>
            <Textarea
              value={reason}
              maxLength={2000}
              rows={2}
              placeholder={t("navigation:documents.decision.reasonPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!text.trim() || !reason.trim() || record.isPending}
            onClick={submit}
          >
            {t("navigation:documents.decision.submit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
