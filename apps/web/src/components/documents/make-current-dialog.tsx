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
import type { DocumentDetail } from "@/fetchers/document/documents";
import type { Topic } from "@/fetchers/topic/topics";
import { useMakeDocumentCurrent } from "@/hooks/mutations/topic/use-topic-mutations";
import {
  useDocument,
  useDocumentVersions,
} from "@/hooks/queries/document/use-documents";
import { toast } from "@/lib/toast";
import { changedSentences } from "./changed-sentences";
import { ChangedSentences } from "./changed-sentences-list";

type MakeCurrentDialogProps = {
  document: Pick<
    DocumentDetail,
    "workspaceId" | "id" | "status" | "content" | "approvedVersionId"
  >;
  topic: Pick<Topic, "id" | "name" | "currentDocumentId">;
  /** The reason to start from, instead of the suggested one. */
  initialReason?: string;
  onClose: () => void;
};

/**
 * The decider's approval, with its reason. A proposal is compared with the
 * document it replaces; an edited current document with the text that was
 * approved, which its history still holds. Either way the decider reads only
 * the sentences that changed, and the reason arrives written for them to
 * accept or edit.
 */
export function MakeCurrentDialog({
  document,
  topic,
  initialReason,
  onClose,
}: MakeCurrentDialogProps) {
  const { t } = useTranslation();
  const { workspaceId, id } = document;
  const approvesEdit = document.status === "current";
  const starts = !approvesEdit && !topic.currentDocumentId;
  const replaced = useDocument(
    workspaceId,
    approvesEdit ? "" : (topic.currentDocumentId ?? ""),
  );
  const versions = useDocumentVersions(workspaceId, id, approvesEdit);
  const makeCurrent = useMakeDocumentCurrent(workspaceId);
  const [typed, setTyped] = useState<string | null>(initialReason ?? null);

  const comparing = approvesEdit ? versions.isLoading : replaced.isLoading;
  const before = approvesEdit
    ? versions.data?.find((row) => row.id === document.approvedVersionId)
        ?.content
    : replaced.data?.content;
  const changes =
    starts || before == null
      ? null
      : changedSentences(before, document.content ?? "");
  const name = approvesEdit ? "reasonEdit" : "reasonReplaces";
  const suggested = starts
    ? t("navigation:documents.makeCurrent.reasonStart")
    : !changes
      ? ""
      : changes.count
        ? t(`navigation:documents.makeCurrent.${name}`, {
            count: changes.count,
          })
        : // Never "0 sentences changed": the text did change, its words did not.
          t(`navigation:documents.makeCurrent.${name}Format`);
  const reason = typed ?? suggested;

  const submit = () =>
    makeCurrent.mutate(
      { workspaceId, id: topic.id, documentId: id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(
            t(
              approvesEdit
                ? "navigation:documents.makeCurrent.doneEdit"
                : "navigation:documents.makeCurrent.done",
            ),
          );
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
            {t(
              approvesEdit
                ? "navigation:documents.makeCurrent.titleEdit"
                : "navigation:documents.makeCurrent.title",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              approvesEdit
                ? "navigation:documents.makeCurrent.hintEdit"
                : starts
                  ? "navigation:documents.makeCurrent.hintStart"
                  : "navigation:documents.makeCurrent.hintReplaces",
              { topic: topic.name },
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          {comparing ? (
            <p className="text-muted-foreground text-xs">
              {t("navigation:documents.makeCurrent.comparing")}
            </p>
          ) : changes ? (
            <ChangedSentences changes={changes} />
          ) : (
            !starts && (
              <p className="text-muted-foreground text-xs">
                {t("navigation:documents.makeCurrent.noBase")}
              </p>
            )
          )}
          <Textarea
            value={reason}
            disabled={comparing}
            maxLength={2000}
            rows={3}
            aria-label={t("navigation:documents.makeCurrent.reasonLabel")}
            placeholder={t("navigation:documents.makeCurrent.reasonLabel")}
            onChange={(event) => setTyped(event.target.value)}
          />
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={comparing || !reason.trim() || makeCurrent.isPending}
            onClick={submit}
          >
            {t(
              approvesEdit
                ? "navigation:documents.makeCurrent.approve"
                : "navigation:documents.makeCurrent.submit",
            )}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
