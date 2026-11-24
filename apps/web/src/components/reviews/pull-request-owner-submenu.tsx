import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MenuCheckboxItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import { useSetPullRequestOwner } from "@/hooks/queries/github-reviews/use-github-reviews";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { ownerSelection } from "@/lib/review-owner";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";

type OwnerPull = Pick<
  PullRequestDetail,
  "reviewOwner" | "originalAuthorUserId"
>;

function OwnerOptions({
  pullRef,
  workspaceId,
  pull,
}: {
  pullRef: PullRef;
  workspaceId: string;
  pull: OwnerPull;
}) {
  const { t } = useTranslation();
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const setOwner = useSetPullRequestOwner(pullRef, workspaceId);
  const members = data?.members ?? [];

  if (members.length === 0) {
    return (
      <p className="px-2 py-1.5 text-muted-foreground text-sm">
        {t("workspace:reviews.prActions.noMembers")}
      </p>
    );
  }
  return (
    <>
      {members.map((member) => (
        <MenuCheckboxItem
          key={member.userId}
          checked={pull.reviewOwner?.userId === member.userId}
          disabled={setOwner.isPending}
          closeOnClick={false}
          onCheckedChange={(checked) =>
            setOwner.mutate(
              ownerSelection(member.userId, pull.originalAuthorUserId, checked),
              { onError: (e) => toast.error(e.message) },
            )
          }
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar className="size-5">
              <AvatarImage src={member.user.image ?? undefined} alt="" />
              <AvatarFallback>{getInitials(member.user.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{member.user.name}</span>
            {member.userId === pull.originalAuthorUserId && (
              <span className="ml-auto shrink-0 pl-2 text-muted-foreground text-xs">
                {t("workspace:reviews.prActions.originalAuthor")}
              </span>
            )}
          </span>
        </MenuCheckboxItem>
      ))}
    </>
  );
}

/** Owner submenu: workspace members as checkboxes; the choice is shared, and the author is the default. */
export function PullRequestOwnerSubmenu({
  pullRef,
  workspaceId,
  pull,
}: {
  pullRef: PullRef;
  workspaceId: string;
  pull: OwnerPull;
}) {
  const { t } = useTranslation();
  return (
    <MenuSub>
      <MenuSubTrigger>
        <UserRound />
        {t("workspace:reviews.prActions.owner")}
      </MenuSubTrigger>
      <MenuSubPopup className="max-h-80 min-w-56 overflow-y-auto">
        <OwnerOptions pullRef={pullRef} workspaceId={workspaceId} pull={pull} />
      </MenuSubPopup>
    </MenuSub>
  );
}
