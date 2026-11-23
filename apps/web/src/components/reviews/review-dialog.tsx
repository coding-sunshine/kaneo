import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
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

export function ReviewDialog({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<ReviewEvent>("COMMENT");
  const [body, setBody] = useState("");
  const submit = useSubmitReview(pullRef);
  // GitHub refuses a comment or change request without text.
  const needsBody = event !== "APPROVE" && body.trim() === "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        {t("workspace:reviews.detail.review")}
      </DialogTrigger>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("workspace:reviews.detail.reviewTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("workspace:reviews.detail.reviewPlaceholder")}
            aria-label={t("workspace:reviews.detail.reviewPlaceholder")}
          />
          <RadioGroup
            value={event}
            onValueChange={(next) => setEvent(next as ReviewEvent)}
            aria-label={t("workspace:reviews.detail.reviewTitle")}
          >
            {EVENTS.map(({ event: value, key }) => (
              <Label key={value} className="flex items-center gap-2">
                <Radio value={value} />
                {t(`workspace:reviews.detail.${key}`)}
              </Label>
            ))}
          </RadioGroup>
        </DialogPanel>
        <DialogFooter>
          <Button
            size="sm"
            loading={submit.isPending}
            disabled={submit.isPending || needsBody}
            onClick={() =>
              submit.mutate(
                { event, body },
                {
                  onSuccess: () => {
                    setBody("");
                    setOpen(false);
                    toast.success(t("workspace:reviews.detail.submitted"));
                  },
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            {t("workspace:reviews.detail.submitReview")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
