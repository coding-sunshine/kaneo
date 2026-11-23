import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReviewerPicker } from "@/components/reviews/reviewer-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";

/** Linear's Add reviewers control: asks one more person on GitHub to review. */
export function AddReviewersPopover({
  pullRef,
  pull,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="-mx-1.5 inline-flex h-7 items-center gap-2 rounded-full px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent">
        <Plus aria-hidden className="size-3.5" />
        {t("workspace:reviews.detail.addReviewers")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <ReviewerPicker
          pullRef={pullRef}
          pull={pull}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
