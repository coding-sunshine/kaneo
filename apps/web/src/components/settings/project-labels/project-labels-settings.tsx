import { PlusIcon, TagIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { LabelColorSwatches } from "@/components/settings/labels/label-color-swatches";
import { LabelPreview } from "@/components/settings/labels/label-preview";
import { LabelRow } from "@/components/settings/labels/label-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
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
  useCreateProjectLabel,
  useDeleteProjectLabel,
  useUpdateProjectLabel,
} from "@/hooks/mutations/project-label/use-project-label-mutations";
import { useGetProjectLabels } from "@/hooks/queries/project-label/use-get-project-labels";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type ProjectLabel = NonNullable<
  ReturnType<typeof useGetProjectLabels>["data"]
>[number];

function ProjectLabelForm({
  label,
  workspaceId,
  onClose,
}: {
  label: ProjectLabel | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateProjectLabel();
  const update = useUpdateProjectLabel();
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? "gray");
  const [error, setError] = useState("");
  const nameId = useId();
  const colorId = useId();
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("settings:workspaceLabels.nameRequired"));
      return;
    }
    try {
      if (label)
        await update.mutateAsync({ id: label.id, name: trimmed, color });
      else await create.mutateAsync({ workspaceId, name: trimmed, color });
      toast.success(
        t(
          label
            ? "settings:workspaceLabels.updateSuccess"
            : "settings:workspaceLabels.createSuccess",
        ),
        { icon: TagIcon },
      );
      onClose();
    } catch (failure) {
      toast.error(
        failure instanceof Error
          ? failure.message
          : t("settings:workspaceLabels.createError"),
      );
    }
  };

  return (
    <form className="contents" noValidate onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>
          {t(
            label
              ? "settings:workspaceLabels.editLabel"
              : "settings:workspaceLabels.newLabel",
          )}
        </DialogTitle>
        <DialogDescription>
          {t("settings:projectLabels.dialogDescription")}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={nameId}>
            {t("settings:workspaceLabels.nameLabel")}
          </Label>
          <Input
            id={nameId}
            value={name}
            placeholder={t("settings:workspaceLabels.namePlaceholder")}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
          {error ? (
            <p role="alert" className="text-destructive-foreground text-xs">
              {error}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <span id={colorId} className="block font-medium text-sm">
            {t("settings:workspaceLabels.colorLabel")}
          </span>
          <LabelColorSwatches
            value={color}
            onChange={setColor}
            labelledBy={colorId}
          />
        </div>
        <LabelPreview name={name.trim()} color={color} />
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t(
            label
              ? "settings:workspaceLabels.saveLabel"
              : "settings:workspaceLabels.createLabel",
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProjectLabelsSettings() {
  const { t } = useTranslation();
  const { workspace, canCreateLabels, canUpdateLabels, canDeleteLabels } =
    useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const labels = useGetProjectLabels(workspaceId);
  const remove = useDeleteProjectLabel();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectLabel | null>(null);
  const [deleting, setDeleting] = useState<ProjectLabel | null>(null);

  const openDialog = (label: ProjectLabel | null) => {
    setEditing(label);
    setDialogOpen(true);
  };
  const newButton = canCreateLabels() ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openDialog(null)}
    >
      <PlusIcon aria-hidden="true" />
      {t("settings:workspaceLabels.newLabel")}
    </Button>
  ) : null;

  const render = () => {
    if (labels.isPending) return <SettingsRowsSkeleton />;
    if (labels.isError)
      return (
        <p
          role="alert"
          className="px-4 py-3.5 text-destructive-foreground text-sm"
        >
          {t("settings:workspaceLabels.loadError")}
        </p>
      );
    if (labels.data.length === 0)
      return (
        <SettingsEmpty
          icon={<TagIcon />}
          title={t("settings:projectLabels.emptyTitle")}
          description={t("settings:projectLabels.emptyDescription")}
          action={newButton}
        />
      );
    return labels.data.map((label) => (
      <LabelRow
        key={label.id}
        label={label}
        canUpdate={canUpdateLabels()}
        canDelete={canDeleteLabels()}
        onEdit={openDialog}
        onDelete={setDeleting}
      />
    ));
  };

  return (
    <>
      <SettingsPage
        title={t("settings:projectLabels.title")}
        description={t("settings:projectLabels.subtitle")}
        actions={newButton}
      >
        <SettingsSection
          title={t("settings:projectLabels.sectionTitle")}
          description={t("settings:projectLabels.sectionDescription")}
        >
          <SettingsCard>{render()}</SettingsCard>
        </SettingsSection>
      </SettingsPage>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPopup className="sm:max-w-md">
          <ProjectLabelForm
            key={editing?.id ?? "new"}
            label={editing}
            workspaceId={workspaceId}
            onClose={() => setDialogOpen(false)}
          />
        </DialogPopup>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("settings:workspaceLabels.deleteConfirmTitle", {
          name: deleting?.name ?? "",
        })}
        description={t("settings:projectLabels.deleteConfirmDescription")}
        confirmLabel={t("settings:workspaceLabels.deleteLabel")}
        pendingLabel={t("common:actions.deleting")}
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success(t("settings:workspaceLabels.deleteSuccess"));
            setDeleting(null);
          } catch (failure) {
            toast.error(
              failure instanceof Error
                ? failure.message
                : t("settings:workspaceLabels.deleteError"),
            );
          }
        }}
      />
    </>
  );
}
