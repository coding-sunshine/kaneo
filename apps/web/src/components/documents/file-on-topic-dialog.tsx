import { useState } from "react";
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
import type { DocumentDetail } from "@/fetchers/document/documents";
import type { Topic } from "@/fetchers/topic/topics";
import { useFileDocumentOnTopic } from "@/hooks/mutations/topic/use-topic-mutations";
import { useDocumentAudience } from "@/hooks/queries/document/use-documents";
import { useTopics } from "@/hooks/queries/topic/use-topics";
import { toast } from "@/lib/toast";
import { DocumentAudience } from "./document-audience";

type FileOnTopicDialogProps = {
  document: Pick<DocumentDetail, "workspaceId" | "id">;
  onClose: () => void;
};

// A filed document moves to where its topic lives.
const placeOf = (topic: Topic) =>
  topic.scope === "project"
    ? { workProjectId: topic.workProjectId ?? undefined }
    : topic.scope === "team"
      ? { projectId: topic.projectId ?? undefined }
      : { scope: "workspace" as const };

/**
 * Files a draft on a topic as a proposal. Filing moves the document, so the
 * dialog first says who will be able to open it there.
 */
export function FileOnTopicDialog({
  document,
  onClose,
}: FileOnTopicDialogProps) {
  const { t } = useTranslation();
  const { workspaceId, id } = document;
  const { data: topics = [], isLoading } = useTopics(workspaceId);
  const [topicId, setTopicId] = useState("");
  const topic = topics.find((row) => row.id === topicId);
  const audience = useDocumentAudience(
    workspaceId,
    id,
    topic ? placeOf(topic) : null,
  );
  const file = useFileDocumentOnTopic(workspaceId);

  const submit = () => {
    if (!topic) return;
    file.mutate(
      { workspaceId, id: topic.id, documentId: id },
      {
        onSuccess: () => {
          toast.success(
            t("navigation:documents.file.done", { topic: topic.name }),
          );
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.file.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.file.hint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          {!isLoading && topics.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("navigation:documents.file.noTopics")}
            </p>
          ) : (
            <select
              value={topicId}
              aria-label={t("navigation:documents.file.topic")}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              onChange={(event) => setTopicId(event.target.value)}
            >
              <option value="">{t("navigation:documents.file.choose")}</option>
              {topics.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.parentName
                    ? `${row.name} · ${row.parentName}`
                    : row.name}
                </option>
              ))}
            </select>
          )}
          {topic && audience.isLoading && (
            <p className="text-muted-foreground text-xs">
              {t("navigation:documents.audience.loading")}
            </p>
          )}
          {topic && audience.isError && (
            <p className="text-destructive-foreground text-xs">
              {t("navigation:documents.audience.failed")}
            </p>
          )}
          {topic && audience.data?.proposed && (
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
          {/* Nobody files before seeing who will be able to open it. */}
          <Button
            size="sm"
            disabled={!audience.data?.proposed || file.isPending}
            onClick={submit}
          >
            {t("navigation:documents.file.submit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
