import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TopicDocument } from "@/fetchers/topic/topics";
import { useSetCurrentDocumentAside } from "@/hooks/mutations/topic/use-topic-mutations";
import { toast } from "@/lib/toast";

type SetAsideDialogProps = { ids: TopicDocument; onClose: () => void };

/** Asks before a current document loses its approval. */
export function SetAsideDialog({ ids, onClose }: SetAsideDialogProps) {
  const { t } = useTranslation();
  const setAside = useSetCurrentDocumentAside(ids.workspaceId);
  const submit = () =>
    setAside.mutate(ids, {
      onSuccess: () => {
        toast.success(t("navigation:documents.setAside.done"));
        onClose();
      },
      onError: (error) => toast.error(error.message),
    });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.setAside.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.setAside.hint")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={setAside.isPending}
            onClick={submit}
          >
            {t("navigation:documents.setAside.action")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
