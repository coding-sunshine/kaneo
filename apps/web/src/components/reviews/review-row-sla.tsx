import { SlaChip } from "@/components/task-chips/sla-chip";
import type { ReviewItem } from "@/lib/reviews-view";

export function ReviewRowSla({ issue }: { issue: ReviewItem["issue"] }) {
  if (!issue) return null;
  return (
    <SlaChip
      task={{
        slaDueAt: issue.slaDueAt ?? null,
        completedAt: issue.completedAt ?? null,
      }}
    />
  );
}
