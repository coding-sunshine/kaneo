import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useUntrackFact } from "@/hooks/mutations/topic/use-fact-mutations";
import { toast } from "@/lib/toast";

type UntrackFactDialogProps = {
  workspaceId: string;
  topicId: string;
  fact: { id: string; name: string };
  onClose: () => void;
};

/** Asks before a fact stops being tracked: the values read for it are lost. */
export function UntrackFactDialog({
  workspaceId,
  topicId,
  fact,
  onClose,
}: UntrackFactDialogProps) {
  const { t } = useTranslation();
  const untrack = useUntrackFact(workspaceId);
  const submit = () =>
    untrack.mutate(
      { workspaceId, id: topicId, slotId: fact.id },
      {
        onSuccess: () =>
          toast.success(
            t("navigation:documents.facts.topic.untrackDone", {
              name: fact.name,
            }),
          ),
        onError: (error) => toast.error(error.message),
        onSettled: onClose,
      },
    );
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("navigation:documents.facts.topic.untrackTitle", {
              name: fact.name,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("navigation:documents.facts.topic.untrackHint")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={untrack.isPending}
            onClick={submit}
          >
            {t("navigation:documents.facts.topic.untrackSubmit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
