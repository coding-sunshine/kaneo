import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  PullRef,
  ReviewEvent,
} from "@/fetchers/github-reviews/github-reviews";
import { useSubmitReview } from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

const EVENTS: { event: ReviewEvent; key: string }[] = [
  { event: "COMMENT", key: "comment" },
  { event: "APPROVE", key: "approve" },
  { event: "REQUEST_CHANGES", key: "requestChanges" },
];

export function ReviewForm({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const submit = useSubmitReview(pullRef);

  const send = (event: ReviewEvent) =>
    submit.mutate(
      { event, body },
      {
        onSuccess: () => {
          setBody("");
          toast.success(t("workspace:reviews.detail.submitted"));
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("workspace:reviews.detail.reviewPlaceholder")}
        aria-label={t("workspace:reviews.detail.reviewPlaceholder")}
      />
      <div className="flex flex-wrap justify-end gap-1.5">
        {EVENTS.map(({ event, key }) => (
          <Button
            key={event}
            size="sm"
            variant={event === "APPROVE" ? "default" : "outline"}
            loading={submit.isPending && submit.variables?.event === event}
            disabled={
              submit.isPending || (event !== "APPROVE" && body.trim() === "")
            }
            onClick={() => send(event)}
          >
            {t(`workspace:reviews.detail.${key}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
