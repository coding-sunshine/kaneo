import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useShareDocumentWithTask } from "@/hooks/mutations/document/use-document-mutations";
import {
  useDocument,
  useDocumentTaskAudience,
} from "@/hooks/queries/document/use-documents";
import { toast } from "@/lib/toast";

type LinkedDocumentAccessRowProps = {
  workspaceId: string;
  taskId: string;
  documentId: string;
  title: string;
};

/** Some people on the issue cannot open a document just linked in its text. */
export function LinkedDocumentAccessRow({
  workspaceId,
  taskId,
  documentId,
  title,
}: LinkedDocumentAccessRowProps) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(false);
  const { data: audience } = useDocumentTaskAudience(
    workspaceId,
    documentId,
    taskId,
  );
  const { data: document } = useDocument(workspaceId, documentId);
  const share = useShareDocumentWithTask(workspaceId);
  if (left || !audience || !document || audience.missing === 0) return null;
  const canShare = document.role === "owner" || document.role === "edit";
  return (
    <div
      role="status"
      className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-warning/8 px-3 py-1.5 text-warning-foreground text-xs dark:bg-warning/16"
    >
      <span>
        {t("navigation:documents.share.taskAudience", {
          count: audience.total,
          missing: audience.missing,
          title,
        })}
        {audience.gains.length > 0 &&
          ` ${t("navigation:documents.share.taskGains", {
            names: audience.gains.map((person) => person.name).join(", "),
          })}`}
      </span>
      {canShare && (
        <Button
          variant="outline"
          size="xs"
          disabled={share.isPending}
          onClick={() =>
            share.mutate(
              { id: documentId, taskId },
              {
                onSuccess: () =>
                  toast.success(t("navigation:documents.share.taskShared")),
                onError: () =>
                  toast.error(
                    t("navigation:documents.share.shareWithTaskFailed"),
                  ),
              },
            )
          }
        >
          {t("navigation:documents.share.shareWithTask")}
        </Button>
      )}
      <Button variant="ghost" size="xs" onClick={() => setLeft(true)}>
        {t("navigation:documents.share.leaveAsItIs")}
      </Button>
    </div>
  );
}
