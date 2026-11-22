import { FileText, Plus, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IssueTemplateDialog,
  type IssueTemplate,
} from "@/components/project/issue-templates/issue-template-dialog";
import { IssueTemplateRow } from "@/components/project/issue-templates/issue-template-row";
import { errorMessage } from "@/components/project/error-message";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useDeleteIssueTemplate from "@/hooks/mutations/issue-template/use-delete-issue-template";
import useGetIssueTemplates from "@/hooks/queries/issue-template/use-get-issue-templates";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type DialogState = {
  open: boolean;
  template: IssueTemplate | null;
  key: number;
};

export function IssueTemplatesPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({
    id: projectId,
    workspaceId: workspace?.id ?? "",
  });
  const { data: templates = [] } = useGetIssueTemplates(projectId);
  const { mutateAsync: deleteTemplate, isPending: deleting } =
    useDeleteIssueTemplate(projectId);
  const canEdit = useWorkspacePermission().canUpdateProjects();
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    template: null,
    key: 0,
  });
  const [pendingDelete, setPendingDelete] = useState<IssueTemplate | null>(
    null,
  );

  const openDialog = (template: IssueTemplate | null) =>
    setDialog((current) => ({ open: true, template, key: current.key + 1 }));

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTemplate({ id: pendingDelete.id });
      setPendingDelete(null);
      toast.success(t("settings:issueTemplates.deleteSuccess"), {
        icon: Trash2Icon,
      });
    } catch (error) {
      toast.error(
        errorMessage(error, t("settings:issueTemplates.deleteError")),
      );
    }
  };

  const newButton = canEdit ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openDialog(null)}
    >
      <Plus aria-hidden="true" />
      {t("settings:issueTemplates.newTemplate")}
    </Button>
  ) : undefined;

  return (
    <SettingsPage
      title={t("settings:issueTemplates.title")}
      description={t("settings:issueTemplates.subtitle", {
        project: project?.name ?? "",
      })}
      actions={newButton}
    >
      <SettingsSection
        title={t("settings:issueTemplates.listTitle")}
        description={t("settings:issueTemplates.listDescription")}
      >
        <SettingsCard>
          {templates.length === 0 ? (
            <SettingsEmpty
              icon={<FileText />}
              title={t("settings:issueTemplates.emptyTitle")}
              description={t("settings:issueTemplates.emptyDescription")}
              action={newButton}
            />
          ) : (
            templates.map((template) => (
              <IssueTemplateRow
                key={template.id}
                template={template}
                canEdit={canEdit}
                onEdit={() => openDialog(template)}
                onDelete={() => setPendingDelete(template)}
              />
            ))
          )}
        </SettingsCard>
      </SettingsSection>
      <IssueTemplateDialog
        key={dialog.key}
        projectId={projectId}
        template={dialog.template}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("settings:issueTemplates.deleteTitle", {
          name: pendingDelete?.name ?? "",
        })}
        description={t("settings:issueTemplates.deleteDescription")}
        confirmLabel={t("settings:issueTemplates.deleteConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </SettingsPage>
  );
}
