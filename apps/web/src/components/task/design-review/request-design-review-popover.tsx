import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useRequestDesignReview from "@/hooks/mutations/design-review/use-request-design-review";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { assigneeMenuOptions } from "../menus/assignee-menu-options";
import { PropertyValue } from "../properties/property-value";

type RequestDesignReviewPopoverProps = {
  task: { id: string; projectId: string };
  workspaceId: string;
  reviewerIds: string[];
};

export function RequestDesignReviewPopover({
  task,
  workspaceId,
  reviewerIds,
}: RequestDesignReviewPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const request = useRequestDesignReview();
  const { data: members = [] } = useGetProjectMembers({
    workspaceId,
    projectId: task.projectId,
  });
  // Drop the menu's leading "unassigned" entry; a review always names someone.
  const options = assigneeMenuOptions(members, undefined, "")
    .slice(1)
    .map((option) => ({
      ...option,
      selected: reviewerIds.includes(option.value),
    }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PropertyValue>
          <Plus className="text-muted-foreground" />
          <span className="truncate text-muted-foreground">
            {t("tasks:designReview.request")}
          </span>
        </PropertyValue>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:designReview.reviewer")}
          placeholder={t("tasks:designReview.reviewerPlaceholder")}
          options={options}
          onSelect={(reviewerId) => {
            setOpen(false);
            request.mutate({ taskId: task.id, reviewerId });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
