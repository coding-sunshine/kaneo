import { useTranslation } from "react-i18next";
import { TaskDraftRow } from "@/components/task-draft/task-draft-row";
import { useDeleteTaskDraft } from "@/hooks/mutations/task-draft/use-delete-task-draft";
import { useTaskDrafts } from "@/hooks/queries/task-draft/use-task-drafts";
import { useCreateIssueStore } from "@/store/create-issue";

/** Linear's Drafts page: the viewer's saved issue drafts, newest first. */
export function TaskDraftList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: drafts = [] } = useTaskDrafts(workspaceId);
  const { mutate: deleteDraft } = useDeleteTaskDraft(workspaceId);
  const openWithSavedDraft = useCreateIssueStore(
    (state) => state.openWithSavedDraft,
  );

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-16 text-center">
        <p className="text-sm font-medium">{t("navigation:drafts.empty")}</p>
        <p className="text-sm text-muted-foreground">
          {t("navigation:drafts.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {drafts.map((draft) => (
        <TaskDraftRow
          key={draft.id}
          draft={draft}
          onOpen={openWithSavedDraft}
          onDelete={(target) => deleteDraft(target.id)}
        />
      ))}
    </ul>
  );
}
