import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeleteCommentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasReplies: boolean;
  onConfirm: () => void;
};

// Linear asks before every comment delete, including a save that empties one.
export default function DeleteCommentDialog({
  open,
  onOpenChange,
  hasReplies,
  onConfirm,
}: DeleteCommentDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("activity:comment.deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            {hasReplies && <p>{t("activity:comment.deleteRepliesNote")}</p>}
            <p>{t("activity:comment.deleteUndoNote")}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button type="button" variant="outline" size="sm" />}
          >
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {t("common:actions.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
