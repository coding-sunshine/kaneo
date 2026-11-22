import { TagIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import { LabelDot } from "@/components/settings/labels/label-dot";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSetProjectLabel } from "@/hooks/mutations/project-label/use-project-label-mutations";
import { useGetProjectLabels } from "@/hooks/queries/project-label/use-get-project-labels";
import { toast } from "@/lib/toast";

type Props = {
  workspaceId: string;
  workProjectId: string;
  labelIds: string[];
  disabled?: boolean;
};

export function WorkProjectLabels({
  workspaceId,
  workProjectId,
  labelIds,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: labels = [] } = useGetProjectLabels(workspaceId);
  const { mutateAsync: setLabel } = useSetProjectLabel();
  const attached = labels.filter((label) => labelIds.includes(label.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 px-2 font-normal text-[13px] [&_svg]:size-3.5"
        >
          <TagIcon />
          {attached.length === 0
            ? t("workspace:workProject.labels.add")
            : attached.map((label) => (
                <span key={label.id} className="flex items-center gap-1">
                  <LabelDot color={label.color} />
                  {label.name}
                </span>
              ))}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("workspace:workProject.labels.title")}
          placeholder={t("workspace:workProject.fields.search")}
          options={labels.map((label) => ({
            value: label.id,
            label: label.name,
            icon: <LabelDot color={label.color} className="size-2.5" />,
            selected: labelIds.includes(label.id),
          }))}
          onSelect={async (labelId) => {
            try {
              await setLabel({
                labelId,
                workProjectId,
                attached: !labelIds.includes(labelId),
              });
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : t("workspace:workProject.labels.error"),
              );
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
