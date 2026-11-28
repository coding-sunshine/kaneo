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

type DocumentConflictDialogProps = {
  name: string;
  theirs: string;
  mine: string;
  onKeepMine: () => void;
  onUseTheirs: () => void;
  onClose: () => void;
};

const textClass =
  "max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 font-mono text-xs";

/** Both texts side by side, so nothing is saved over unseen. */
export function DocumentConflictDialog({
  name,
  theirs,
  mine,
  onKeepMine,
  onUseTheirs,
  onClose,
}: DocumentConflictDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.conflict.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.conflict.description", { name })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="grid gap-3 sm:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-1.5">
            <h3 className="font-medium text-sm">
              {t("navigation:documents.conflict.theirs", { name })}
            </h3>
            <pre className={textClass}>{theirs}</pre>
          </section>
          <section className="flex min-w-0 flex-col gap-1.5">
            <h3 className="font-medium text-sm">
              {t("navigation:documents.conflict.mine")}
            </h3>
            <pre className={textClass}>{mine}</pre>
          </section>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onUseTheirs}>
            {t("navigation:documents.conflict.useTheirs")}
          </Button>
          <Button size="sm" onClick={onKeepMine}>
            {t("navigation:documents.conflict.keepMine")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
