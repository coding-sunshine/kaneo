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

type PrivateTeamConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  makePrivate: boolean;
  projectName: string;
  onConfirm: () => void;
};

export function PrivateTeamConfirmDialog({
  open,
  onOpenChange,
  makePrivate,
  projectName,
  onConfirm,
}: PrivateTeamConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {makePrivate
              ? t("settings:projectVisibility.makePrivateTitle", {
                  project: projectName,
                })
              : t("settings:projectVisibility.openTeamTitle", {
                  project: projectName,
                })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {makePrivate
              ? t("settings:projectVisibility.makePrivateBody")
              : t("settings:projectVisibility.openTeamBody")}
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
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {makePrivate
              ? t("settings:projectVisibility.makePrivateConfirm")
              : t("settings:projectVisibility.openTeamConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
