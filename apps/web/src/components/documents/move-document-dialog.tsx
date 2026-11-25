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
import type { moveDocument } from "@/fetchers/document/documents";
import { useMoveDocument } from "@/hooks/mutations/document/use-document-mutations";
import { useDocumentAudience } from "@/hooks/queries/document/use-documents";
import { toast } from "@/lib/toast";
import { DocumentAudience } from "./document-audience";

export type MoveLocation = Parameters<typeof moveDocument>[2];

type MoveDocumentDialogProps = {
  workspaceId: string;
  document: { id: string; title: string };
  target: { location: MoveLocation; name: string };
  onClose: () => void;
};

/** A move changes who can open the document, so it says who before it moves. */
export function MoveDocumentDialog({
  workspaceId,
  document,
  target,
  onClose,
}: MoveDocumentDialogProps) {
  const { t } = useTranslation();
  const { location } = target;
  const audience = useDocumentAudience(workspaceId, document.id, {
    scope: location.scope,
    projectId: location.projectId ?? undefined,
    workProjectId: location.workProjectId ?? undefined,
    taskId: location.taskId ?? undefined,
  });
  const move = useMoveDocument(workspaceId, document.id);

  const submit = () =>
    move.mutate(location, {
      onSuccess: () => {
        toast.success(t("navigation:documents.moved"));
        onClose();
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t("navigation:documents.move.title", { place: target.name })}
          </DialogTitle>
          <DialogDescription>
            {t("navigation:documents.move.description", {
              title: document.title || t("navigation:documents.untitled"),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          {audience.isLoading && (
            <p className="text-muted-foreground text-xs">
              {t("navigation:documents.audience.loading")}
            </p>
          )}
          {audience.isError && (
            <p className="text-destructive-foreground text-xs">
              {t("navigation:documents.audience.failed")}
            </p>
          )}
          {audience.data?.proposed && (
            <DocumentAudience
              current={audience.data.current}
              proposed={audience.data.proposed}
            />
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!audience.data?.proposed || move.isPending}
            onClick={submit}
          >
            {t("navigation:documents.move.confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
