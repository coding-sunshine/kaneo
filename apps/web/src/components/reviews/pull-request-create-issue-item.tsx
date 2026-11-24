import { SquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildPullRequestIssueDraft } from "@/components/reviews/pull-request-issue-draft";
import { MenuItem } from "@/components/ui/menu";
import type { PullRequestDetail } from "@/fetchers/github-reviews/github-reviews";
import { useCreateIssueStore } from "@/store/create-issue";

/** Opens the create-issue modal seeded from the pull request, which it links on create. */
export function PullRequestCreateIssueItem({
  pull,
}: {
  pull: Pick<PullRequestDetail, "title" | "url" | "status">;
}) {
  const { t } = useTranslation();
  const openWithDraft = useCreateIssueStore((state) => state.openWithDraft);
  return (
    <MenuItem onClick={() => openWithDraft(buildPullRequestIssueDraft(pull))}>
      <SquarePlus />
      {t("workspace:reviews.prActions.createIssue")}
    </MenuItem>
  );
}
