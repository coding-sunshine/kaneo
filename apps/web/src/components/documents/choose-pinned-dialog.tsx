import { FileText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { toast } from "@/lib/toast";
import { useDocumentPins } from "./use-document-pins";

type ChoosePinnedDialogProps = {
  workspaceId: string;
  documents: DocumentSummary[];
  onClose: () => void;
};

/** Tick the documents to keep at the top of the Documents page. */
export function ChoosePinnedDialog({
  workspaceId,
  documents,
  onClose,
}: ChoosePinnedDialogProps) {
  const { t } = useTranslation();
  const pins = useDocumentPins(workspaceId);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = documents.filter((document) =>
    (document.title || "").toLowerCase().includes(needle),
  );
  const flip = (id: string, on: boolean) =>
    (on ? pins.pin([id]) : pins.unpin(id)).catch((error: Error) =>
      toast.error(error.message),
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.pins.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.pins.emptyHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("navigation:documents.pins.search")}
            aria-label={t("navigation:documents.pins.search")}
          />
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {shown.map((document) => {
              const title =
                document.title || t("navigation:documents.untitled");
              return (
                <li key={document.id}>
                  <label className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-accent/50">
                    <Checkbox
                      checked={pins.pinnedIds.includes(document.id)}
                      onCheckedChange={(on) => flip(document.id, on)}
                    />
                    <FileText
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </DialogPanel>
        <DialogFooter>
          <Button size="sm" onClick={onClose}>
            {t("navigation:documents.pins.done")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
