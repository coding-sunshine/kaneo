import type { Editor } from "@tiptap/core";
import { useEffect, useRef } from "react";
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
import type { WritingAction } from "@/fetchers/agent/writing-help";
import { useWritingHelp } from "@/hooks/mutations/agent/use-writing-help";
import { toast } from "@/lib/toast";
import {
  replaceSelection,
  selectedText,
  type TextRange,
} from "./replace-selection";
import { WritingDiff } from "./writing-diff";

type Props = {
  workspaceId: string;
  editor: Editor;
  action: WritingAction;
  range: TextRange;
  onClose: () => void;
};

/**
 * Asks for the rewrite and shows it against the selection. Accept puts it in
 * as one change (one undo brings the original back); Decline changes nothing.
 */
export function WritingHelpDialog({
  workspaceId,
  editor,
  action,
  range,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const original = useRef(selectedText(editor, range)).current;
  const help = useWritingHelp(workspaceId);
  const { mutate } = help;
  useEffect(() => {
    mutate({ action, text: original });
  }, [mutate, action, original]);

  const accept = () => {
    if (!help.data) return;
    // The text may have changed while the model worked; then nothing is put in.
    if (selectedText(editor, range) !== original) {
      toast.error(t("navigation:documents.writing.changed"));
      onClose();
      return;
    }
    replaceSelection(editor, range, help.data.text);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t(`navigation:documents.writing.actions.${action}`)}
          </DialogTitle>
          <DialogDescription>
            {t("navigation:documents.writing.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {help.isPending ? (
            <p role="status" className="text-muted-foreground text-sm">
              {t("navigation:documents.writing.working")}
            </p>
          ) : help.isError ? (
            <p role="alert" className="text-destructive text-sm">
              {help.error.message}
            </p>
          ) : help.data ? (
            <WritingDiff before={original} after={help.data.text} />
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("navigation:documents.writing.decline")}
          </Button>
          <Button disabled={!help.data} onClick={accept}>
            {t("navigation:documents.writing.accept")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
