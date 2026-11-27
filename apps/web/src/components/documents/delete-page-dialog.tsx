import { useId, useState } from "react";
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
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import type { ChildPages } from "@/fetchers/document/documents";
import { useDeleteDocument } from "@/hooks/mutations/document/use-document-mutations";
import { toast } from "@/lib/toast";

type DeletePageDialogProps = {
  workspaceId: string;
  id: string;
  onClose: () => void;
  onDeleted: (result: { id: string; alsoDeleted: string[] }) => void;
};

/** Deleting a page with pages under it: move them up, or delete them too. */
export function DeletePageDialog({
  workspaceId,
  id,
  onClose,
  onDeleted,
}: DeletePageDialogProps) {
  const { t } = useTranslation();
  const labelId = useId();
  const remove = useDeleteDocument(workspaceId);
  const [children, setChildren] = useState<ChildPages>("lift");
  const submit = () =>
    remove.mutate(
      { id, children },
      { onSuccess: onDeleted, onError: (error) => toast.error(error.message) },
    );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t("navigation:documents.pageTree.delete.title")}
          </DialogTitle>
          <DialogDescription id={labelId}>
            {t("navigation:documents.pageTree.delete.hint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <RadioGroup
            aria-labelledby={labelId}
            value={children}
            onValueChange={(value) => setChildren(value as ChildPages)}
          >
            <Label className="items-start">
              <Radio value="lift" className="mt-0.5" />
              {t("navigation:documents.pageTree.delete.liftChildren")}
            </Label>
            <Label className="items-start">
              <Radio value="delete" className="mt-0.5" />
              {t("navigation:documents.pageTree.delete.deleteChildren")}
            </Label>
          </RadioGroup>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={submit}
          >
            {t("navigation:documents.pageTree.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
