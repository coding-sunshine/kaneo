import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentDetail } from "@/fetchers/document/documents";
import type { Topic } from "@/fetchers/topic/topics";
import { useConfirmCurrentDocument } from "@/hooks/mutations/topic/use-topic-mutations";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { toast } from "@/lib/toast";
import { editedAfterApproval } from "./document-approval";
import { DOCUMENT_SAVE_OWNER } from "./document-save";
import { FileOnTopicDialog } from "./file-on-topic-dialog";
import { MakeCurrentDialog } from "./make-current-dialog";
import { SetAsideDialog } from "./set-aside-dialog";

type DocumentTopicActionsProps = {
  document: DocumentDetail;
  /** The topic the document is filed on, when this reader may open it. */
  topic: Topic | undefined;
  canEdit: boolean;
};

/**
 * The next step on a document's way to being relied on. An editor files a
 * draft on a topic; whoever decides on that topic makes it current, confirms
 * it, approves an edit to it or sets it aside. The API checks each of these
 * again.
 */
export function DocumentTopicActions({
  document,
  topic,
  canEdit,
}: DocumentTopicActionsProps) {
  const { t } = useTranslation();
  const { workspaceId, status } = document;
  const [dialog, setDialog] = useState<"file" | "current" | "aside" | null>(
    null,
  );
  const confirm = useConfirmCurrentDocument(workspaceId);
  const ids = topic && { workspaceId, id: topic.id, documentId: document.id };
  const decides = Boolean(topic?.canDecide);

  // A dialog shows and sends the saved text, so typing on its way lands first.
  const open = async (next: typeof dialog) => {
    if (!(await descriptionSaveQueue.drain(DOCUMENT_SAVE_OWNER))) {
      toast.error(t("navigation:documents.saveFailed"));
      return;
    }
    setDialog(next);
  };
  const close = () => setDialog(null);

  return (
    <>
      {status === "draft" && canEdit && (
        <Button size="xs" variant="outline" onClick={() => open("file")}>
          {t("navigation:documents.file.action")}
        </Button>
      )}
      {decides && status === "in_review" && (
        <Button size="xs" onClick={() => open("current")}>
          {t("navigation:documents.makeCurrent.action")}
        </Button>
      )}
      {decides && status === "current" && ids && (
        <>
          <Button size="xs" variant="ghost" onClick={() => setDialog("aside")}>
            {t("navigation:documents.setAside.action")}
          </Button>
          {editedAfterApproval(document) ? (
            <Button size="xs" onClick={() => open("current")}>
              {t("navigation:documents.makeCurrent.review")}
            </Button>
          ) : (
            <Button
              size="xs"
              variant="outline"
              disabled={confirm.isPending}
              onClick={() =>
                confirm.mutate(ids, {
                  onSuccess: () =>
                    toast.success(
                      t("navigation:documents.makeCurrent.confirmed"),
                    ),
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              {t("navigation:documents.makeCurrent.stillCurrent")}
            </Button>
          )}
        </>
      )}
      {dialog === "file" && (
        <FileOnTopicDialog document={document} onClose={close} />
      )}
      {dialog === "current" && topic && (
        <MakeCurrentDialog document={document} topic={topic} onClose={close} />
      )}
      {dialog === "aside" && ids && (
        <SetAsideDialog ids={ids} onClose={close} />
      )}
    </>
  );
}
