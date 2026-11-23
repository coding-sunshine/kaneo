import { UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReviewerPicker } from "@/components/reviews/reviewer-picker";
import { MenuSub, MenuSubPopup, MenuSubTrigger } from "@/components/ui/menu";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";

/** "Select reviewers" submenu; the picker mounts (and loads candidates) only once opened. */
export function PullRequestReviewersSubmenu({
  pullRef,
  pull,
}: {
  pullRef: PullRef;
  pull: Pick<PullRequestDetail, "author" | "requestedReviewers">;
}) {
  const { t } = useTranslation();
  return (
    <MenuSub>
      <MenuSubTrigger>
        <UserPlus />
        {t("workspace:reviews.prActions.selectReviewers")}
      </MenuSubTrigger>
      <MenuSubPopup className="w-64 p-1">
        <ReviewerPicker pullRef={pullRef} pull={pull} onDone={() => {}} />
      </MenuSubPopup>
    </MenuSub>
  );
}
