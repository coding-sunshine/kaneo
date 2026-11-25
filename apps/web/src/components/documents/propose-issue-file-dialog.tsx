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
import type { IssueFile } from "@/fetchers/document/issue-files";
import { useProposeIssueFile } from "@/hooks/mutations/document/use-propose-issue-file";
import { useIssueFileAudience } from "@/hooks/queries/document/use-issue-files";
import { toast } from "@/lib/toast";
import { DocumentAudience } from "./document-audience";

type ProposeIssueFileDialogProps = {
  workspaceId: string;
  file: Pick<IssueFile, "id" | "filename">;
  topic: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Makes a document of an issue's file on a topic of that issue. The person
 * first sees who can open the file now and who could open the document.
 */
export function ProposeIssueFileDialog({
  workspaceId,
  file,
  topic,
  open,
  onOpenChange,
}: ProposeIssueFileDialogProps) {
  const { t } = useTranslation();
  const audience = useIssueFileAudience(workspaceId, file.id, topic.id, open);
  const propose = useProposeIssueFile(workspaceId);

  const submit = () =>
    propose.mutate(
      { assetId: file.id, topicId: topic.id },
      {
        onSuccess: () => {
          toast.success(
            t("navigation:documents.issueFiles.dialog.done", {
              topic: topic.name,
            }),
          );
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t("navigation:documents.issueFiles.dialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("navigation:documents.issueFiles.dialog.hint", {
              file: file.filename,
              topic: topic.name,
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
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          {/* Nobody proposes before seeing who could open it. */}
          <Button
            size="sm"
            disabled={!audience.data?.proposed || propose.isPending}
            onClick={submit}
          >
            {t("navigation:documents.issueFiles.dialog.submit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
