import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import {
  useClosePullRequest,
  useConvertToDraft,
  useMergePullRequest,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

export type PullRequestAction = "draft" | "squash" | "close";

const COPY = {
  draft: {
    title: "convertTitle",
    description: "convertDescription",
    label: "convertToDraft",
    done: "converted",
  },
  squash: {
    title: "squashTitle",
    description: "squashDescription",
    label: "squashMerge",
    done: "merged",
  },
  close: {
    title: "closeTitle",
    description: "closeDescription",
    label: "closePullRequest",
    done: "closed",
  },
} as const;

/** One confirmation for the three destructive writes; confirming runs the GitHub call. */
export function PullRequestActionDialog({
  pullRef,
  pull,
  action,
  onClose,
}: {
  pullRef: PullRef;
  pull: Pick<PullRequestDetail, "title" | "baseRef">;
  action: PullRequestAction | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const draft = useConvertToDraft(pullRef);
  const merge = useMergePullRequest(pullRef);
  const close = useClosePullRequest(pullRef);
  const copy = COPY[action ?? "draft"];
  const pending = draft.isPending || merge.isPending || close.isPending;

  const run = () => {
    if (!action) return;
    const options = {
      onSuccess: () => {
        onClose();
        const key =
          action === "squash" ? "detail.merged" : `prActions.${copy.done}`;
        toast.success(t(`workspace:reviews.${key}`));
      },
      onError: (error: Error) => {
        onClose();
        toast.error(error.message);
      },
    };
    if (action === "draft") draft.mutate(undefined, options);
    else if (action === "close") close.mutate(undefined, options);
    else merge.mutate("squash", options);
  };

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t(`workspace:reviews.prActions.${copy.title}`, {
        title: pull.title,
      })}
      description={t(`workspace:reviews.prActions.${copy.description}`, {
        base: pull.baseRef,
      })}
      confirmLabel={t(`workspace:reviews.prActions.${copy.label}`)}
      destructive={action === "close"}
      pending={pending}
      onConfirm={run}
    />
  );
}
