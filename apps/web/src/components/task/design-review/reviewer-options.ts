import { assigneeMenuOptions } from "../menus/assignee-menu-options";

type Member = Parameters<typeof assigneeMenuOptions>[0][number];

// Everyone but the caller, who cannot review their own request. The menu's
// leading "unassigned" entry goes too: a review always names someone.
export function reviewerOptions(
  members: Member[],
  currentUserId: string | undefined,
  reviewerIds: string[],
) {
  return assigneeMenuOptions(
    members.filter((member) => member.id !== currentUserId),
    undefined,
    "",
  )
    .slice(1)
    .map((option) => ({
      ...option,
      selected: reviewerIds.includes(option.value),
    }));
}
