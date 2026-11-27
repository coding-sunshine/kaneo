import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useGetDesignReviews from "@/hooks/queries/design-review/use-get-design-reviews";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { RailSection } from "../properties/rail-section";
import { DesignReviewEntry } from "./design-review-entry";
import { RequestDesignReviewPopover } from "./request-design-review-popover";

type DesignReviewSectionProps = {
  task: { id: string; projectId: string };
  workspaceId: string;
};

export function DesignReviewSection({
  task,
  workspaceId,
}: DesignReviewSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canUpdateTasks } = useWorkspacePermission();
  const { data: reviews = [] } = useGetDesignReviews(task.id);
  const canEdit = canUpdateTasks();

  if (!reviews.length && !canEdit) return null;

  return (
    <RailSection title={t("tasks:designReview.title")}>
      {reviews.map((review) => (
        <DesignReviewEntry
          key={review.reviewerId}
          review={review}
          isMine={review.reviewerId === user?.id}
          canWithdraw={canEdit}
        />
      ))}
      {canEdit && (
        <RequestDesignReviewPopover
          task={task}
          workspaceId={workspaceId}
          reviewerIds={reviews.map((review) => review.reviewerId)}
        />
      )}
    </RailSection>
  );
}
