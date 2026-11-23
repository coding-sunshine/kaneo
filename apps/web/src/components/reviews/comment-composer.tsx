import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useAddPullRequestComment } from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

export function CommentComposer({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const add = useAddPullRequestComment(pullRef);

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("workspace:reviews.detail.commentPlaceholder")}
        aria-label={t("workspace:reviews.detail.commentPlaceholder")}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          loading={add.isPending}
          disabled={add.isPending || body.trim() === ""}
          onClick={() =>
            add.mutate(body.trim(), {
              onSuccess: () => setBody(""),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          {t("workspace:reviews.detail.addComment")}
        </Button>
      </div>
    </div>
  );
}
