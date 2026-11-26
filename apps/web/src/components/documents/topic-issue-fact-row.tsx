import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { TopicTaskStatement } from "@/fetchers/topic/task-statements";
import {
  useLinkTaskTopic,
  useSetTaskStatementDismissed,
} from "@/hooks/mutations/topic/use-topic-mutations";
import { toast } from "@/lib/toast";

type TopicIssueFactRowProps = {
  workspaceId: string;
  topicId: string;
  fact: TopicTaskStatement;
  canEdit: boolean;
};

const linkClass = "text-info-foreground underline underline-offset-2";

/** One fact found in an issue: where it came from, and what a person can do with it. */
export function TopicIssueFactRow({
  workspaceId,
  topicId,
  fact,
  canEdit,
}: TopicIssueFactRowProps) {
  const { t } = useTranslation();
  const link = useLinkTaskTopic(workspaceId);
  const dismiss = useSetTaskStatementDismissed(workspaceId);
  const { task } = fact;
  const key = `${task.projectSlug.toUpperCase()}${task.number == null ? "" : `-${task.number}`}`;
  const setDismissed = (dismissed: boolean) =>
    dismiss.mutate(
      { id: topicId, factId: fact.id, dismissed },
      {
        onError: () =>
          toast.error(
            dismissed
              ? t("navigation:documents.issueFacts.dismissFailed")
              : t("navigation:documents.issueFacts.restoreFailed"),
          ),
      },
    );
  const labelArgs = { name: fact.slotName, value: fact.value };
  return (
    <li className="grid gap-x-4 gap-y-0.5 rounded-md px-2 py-2 sm:grid-cols-[10rem_1fr_auto]">
      <p className="min-w-0 break-words font-medium text-[13px]">
        {fact.slotName}
      </p>
      <div className="min-w-0 break-words text-[13px]">
        <p>{fact.value}</p>
        <p className="min-w-0 break-words text-muted-foreground text-xs">
          <q>{fact.quote}</q>{" "}
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
            className={linkClass}
          >
            <span>{key}</span> <span>{task.title}</span>
          </Link>
          {fact.file && (
            <>
              {" "}
              {t("navigation:documents.issueFacts.inFile", {
                filename: fact.file.filename,
              })}
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1 self-start">
        {!fact.dismissed && fact.onTopic && (
          <span className="text-muted-foreground text-xs">
            {t("navigation:documents.issueFacts.onTopic")}
          </span>
        )}
        {canEdit && !fact.dismissed && !fact.onTopic && (
          <Button
            size="xs"
            variant="ghost"
            disabled={link.isPending}
            aria-label={t("navigation:documents.issueFacts.addIssueLabel", {
              issue: key,
            })}
            onClick={() =>
              link.mutate(
                { workspaceId, id: topicId, taskId: task.id },
                {
                  onError: () =>
                    toast.error(t("navigation:documents.issueFacts.addFailed")),
                },
              )
            }
          >
            {t("navigation:documents.issueFacts.addIssue")}
          </Button>
        )}
        {canEdit && (
          <Button
            size="xs"
            variant="ghost"
            disabled={dismiss.isPending}
            aria-label={
              fact.dismissed
                ? t("navigation:documents.issueFacts.restoreLabel", labelArgs)
                : t("navigation:documents.issueFacts.dismissLabel", labelArgs)
            }
            onClick={() => setDismissed(!fact.dismissed)}
          >
            {fact.dismissed
              ? t("navigation:documents.issueFacts.restore")
              : t("navigation:documents.issueFacts.dismiss")}
          </Button>
        )}
      </div>
    </li>
  );
}
