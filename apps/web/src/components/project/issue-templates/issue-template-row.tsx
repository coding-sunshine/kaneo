import { FileText, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IssueTemplate } from "@/components/project/issue-templates/issue-template-dialog";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { SettingsRow } from "@/components/settings/settings-row";

type IssueTemplateRowProps = {
  template: IssueTemplate;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function IssueTemplateRow({
  template,
  canEdit,
  onEdit,
  onDelete,
}: IssueTemplateRowProps) {
  const { t } = useTranslation();

  return (
    <SettingsRow
      icon={<FileText />}
      title={template.name}
      description={template.title || undefined}
    >
      {canEdit ? (
        <RowActionsMenu
          label={t("settings:issueTemplates.actionsAria", {
            name: template.name,
          })}
          actions={[
            {
              id: "edit",
              label: t("settings:issueTemplates.edit"),
              icon: Pencil,
              onSelect: onEdit,
            },
            {
              id: "delete",
              label: t("common:actions.delete"),
              icon: Trash2,
              onSelect: onDelete,
              destructive: true,
            },
          ]}
        />
      ) : null}
    </SettingsRow>
  );
}
