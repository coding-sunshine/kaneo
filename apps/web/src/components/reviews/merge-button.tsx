import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Button } from "@/components/ui/button";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import { useMergePullRequest } from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

export function MergeButton({
  pullRef,
  pull,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const merge = useMergePullRequest(pullRef);

  return (
    <>
      <Button
        size="sm"
        // GitHub reports null while it is still computing mergeability.
        disabled={pull.mergeable !== true}
        onClick={() => setOpen(true)}
      >
        {t("workspace:reviews.detail.merge")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("workspace:reviews.detail.mergeTitle", {
          title: pull.title,
        })}
        description={t("workspace:reviews.detail.mergeDescription", {
          base: pull.baseRef,
        })}
        confirmLabel={t("workspace:reviews.detail.merge")}
        destructive={false}
        pending={merge.isPending}
        onConfirm={() =>
          merge.mutate("merge", {
            onSuccess: () => {
              setOpen(false);
              toast.success(t("workspace:reviews.detail.merged"));
            },
            onError: (error) => {
              setOpen(false);
              toast.error(error.message);
            },
          })
        }
      />
    </>
  );
}
