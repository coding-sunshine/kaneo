import { TagIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LabelColorSwatches } from "@/components/settings/labels/label-color-swatches";
import { LabelPreview } from "@/components/settings/labels/label-preview";
import type { WorkspaceLabel } from "@/components/settings/labels/workspace-label";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
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
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useUpdateLabel from "@/hooks/mutations/label/use-update-label";
import { toast } from "@/lib/toast";

const NO_GROUP = "none";

type LabelFormProps = {
  label: WorkspaceLabel | null;
  workspaceId: string;
  projectId?: string;
  groupOptions: WorkspaceLabel[];
  onClose: () => void;
};

export function LabelForm({
  label,
  workspaceId,
  projectId,
  groupOptions,
  onClose,
}: LabelFormProps) {
  const { t } = useTranslation();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? "gray");
  const [parentId, setParentId] = useState(label?.parentLabelId ?? NO_GROUP);
  const [error, setError] = useState("");
  const nameId = useId();
  const errorId = useId();
  const colorId = useId();
  const groupId = useId();
  const isEditing = label !== null;
  const isPending = createLabel.isPending || updateLabel.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("settings:workspaceLabels.nameRequired"));
      return;
    }

    try {
      if (label) {
        await updateLabel.mutateAsync({
          id: label.id,
          name: trimmed,
          color,
          parentLabelId: parentId === NO_GROUP ? null : parentId,
        });
        toast.success(t("settings:workspaceLabels.updateSuccess"), {
          icon: TagIcon,
        });
      } else {
        await createLabel.mutateAsync({
          name: trimmed,
          color,
          workspaceId,
          projectId,
          parentLabelId: parentId === NO_GROUP ? undefined : parentId,
        });
        toast.success(t("settings:workspaceLabels.createSuccess"), {
          icon: TagIcon,
        });
      }
      onClose();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : t(
              isEditing
                ? "settings:workspaceLabels.updateError"
                : "settings:workspaceLabels.createError",
            ),
      );
    }
  };

  return (
    <form className="contents" noValidate onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {t(
            isEditing
              ? "settings:workspaceLabels.editLabel"
              : "settings:workspaceLabels.newLabel",
          )}
        </DialogTitle>
        <DialogDescription>
          {t(
            isEditing
              ? "settings:workspaceLabels.editDescription"
              : "settings:workspaceLabels.createDescription",
          )}
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
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
          {error ? (
            <p id={errorId} className="text-destructive-foreground text-xs">
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
        {groupOptions.length > 0 || parentId !== NO_GROUP ? (
          <div className="space-y-2">
            <span id={groupId} className="block font-medium text-sm">
              {t("settings:workspaceLabels.groupLabel")}
            </span>
            <Select
              value={parentId}
              onValueChange={(next) => setParentId(next ?? NO_GROUP)}
            >
              <SelectTrigger aria-labelledby={groupId} className="w-full">
                <SelectValue>
                  {groupOptions.find((group) => group.id === parentId)?.name ??
                    t("settings:workspaceLabels.noGroup")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP}>
                  {t("settings:workspaceLabels.noGroup")}
                </SelectItem>
                {groupOptions.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <LabelPreview name={name.trim()} color={color} />
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {t(
            isEditing
              ? "settings:workspaceLabels.saveLabel"
              : "settings:workspaceLabels.createLabel",
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
