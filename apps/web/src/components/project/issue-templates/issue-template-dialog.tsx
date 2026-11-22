import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type getIssueTemplates from "@/fetchers/issue-template/get-issue-templates";
import useCreateIssueTemplate from "@/hooks/mutations/issue-template/use-create-issue-template";
import useUpdateIssueTemplate from "@/hooks/mutations/issue-template/use-update-issue-template";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

export type IssueTemplate = Awaited<
  ReturnType<typeof getIssueTemplates>
>[number];

const NONE = "__none__";
const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;
type TemplatePriority = (typeof PRIORITIES)[number];

type IssueTemplateDialogProps = {
  projectId: string;
  template: IssueTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IssueTemplateDialog({
  projectId,
  template,
  open,
  onOpenChange,
}: IssueTemplateDialogProps) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data: columns = [] } = useGetColumns(projectId);
  const { data: members = [] } = useGetProjectMembers({
    workspaceId,
    projectId,
  });
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const { mutateAsync: create, isPending: creating } =
    useCreateIssueTemplate(projectId);
  const { mutateAsync: update, isPending: updating } =
    useUpdateIssueTemplate(projectId);
  const [name, setName] = useState(template?.name ?? "");
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [columnId, setColumnId] = useState(template?.columnId ?? NONE);
  const [priority, setPriority] = useState<TemplatePriority>(
    (template?.priority as TemplatePriority | undefined) ?? "no-priority",
  );
  const [assigneeId, setAssigneeId] = useState(template?.assigneeId ?? NONE);
  const [labels, setLabels] = useState(template?.labels ?? []);
  const nameId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const pending = creating || updating;

  const labelChoices = [
    ...new Map(workspaceLabels.map((label) => [label.name, label])).values(),
  ];
  const toggleLabel = (label: { name: string; color: string }) =>
    setLabels((current) =>
      current.some((item) => item.name === label.name)
        ? current.filter((item) => item.name !== label.name)
        : [...current, { name: label.name, color: label.color }],
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || pending) return;
    const data = {
      name: name.trim(),
      title,
      description,
      priority,
      columnId: columnId === NONE ? null : columnId,
      assigneeId: assigneeId === NONE ? null : assigneeId,
      labels,
    };
    try {
      if (template) {
        await update({ id: template.id, data });
        toast.success(t("settings:issueTemplates.updateSuccess"));
      } else {
        await create({ projectId, ...data });
        toast.success(t("settings:issueTemplates.createSuccess"));
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, t("settings:issueTemplates.saveError")));
    }
  };

  const columnName = columns.find((column) => column.id === columnId)?.name;
  const assigneeName = members.find((member) => member.id === assigneeId)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-120">
        <form className="contents" noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {template
                ? t("settings:issueTemplates.editTitle")
                : t("settings:issueTemplates.newTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:issueTemplates.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={nameId}>
                {t("settings:issueTemplates.nameLabel")}
              </Label>
              <Input
                id={nameId}
                value={name}
                autoComplete="off"
                placeholder={t("settings:issueTemplates.namePlaceholder")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={titleId}>
                {t("settings:issueTemplates.titleLabel")}
              </Label>
              <Input
                id={titleId}
                value={title}
                autoComplete="off"
                placeholder={t("settings:issueTemplates.titlePlaceholder")}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={descriptionId}>
                {t("settings:issueTemplates.descriptionLabel")}
              </Label>
              <Textarea
                id={descriptionId}
                value={description}
                rows={5}
                placeholder={t(
                  "settings:issueTemplates.descriptionPlaceholder",
                )}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("settings:issueTemplates.statusLabel")}</Label>
                <Select
                  value={columnId}
                  onValueChange={(next) => setColumnId(next ?? NONE)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {columnName ?? t("settings:issueTemplates.noStatus")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      {t("settings:issueTemplates.noStatus")}
                    </SelectItem>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("settings:issueTemplates.priorityLabel")}</Label>
                <Select
                  value={priority}
                  onValueChange={(next) =>
                    setPriority((next as TemplatePriority) ?? "no-priority")
                  }
                >
                  <SelectTrigger>
                    <SelectValue>{t(`tasks:priority.${priority}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`tasks:priority.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("settings:issueTemplates.assigneeLabel")}</Label>
                <Select
                  value={assigneeId}
                  onValueChange={(next) => setAssigneeId(next ?? NONE)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {assigneeName ?? t("settings:issueTemplates.noAssignee")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      {t("settings:issueTemplates.noAssignee")}
                    </SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {labelChoices.length > 0 ? (
              <div className="space-y-2">
                <Label>{t("settings:issueTemplates.labelsLabel")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {labelChoices.map((label) => {
                    const selected = labels.some(
                      (item) => item.name === label.name,
                    );
                    return (
                      <button
                        key={label.name}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleLabel(label)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                          selected
                            ? "border-foreground bg-accent text-foreground"
                            : "border-border text-muted-foreground hover:bg-accent/50",
                        )}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {t(
                template
                  ? "settings:issueTemplates.save"
                  : "settings:issueTemplates.create",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
