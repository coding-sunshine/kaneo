import { useTranslation } from "react-i18next";
import { IssuePicker } from "@/components/reviews/issue-picker";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";

/** The Overview "Resolves" link flow, in a dialog for the ⋯ menu's Link issue item. */
export function LinkIssueDialog({
  open,
  onOpenChange,
  pullRef,
  pull,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pullRef: PullRef;
  pull: Pick<PullRequestDetail, "url" | "status">;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("workspace:reviews.detail.linkIssueLabel")}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <IssuePicker
            pullRef={pullRef}
            pull={pull}
            workspaceId={workspaceId}
            onDone={() => onOpenChange(false)}
          />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
