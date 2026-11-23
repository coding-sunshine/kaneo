import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";

export function ChecksIcon({ state }: { state: ReviewPullRequest["checks"] }) {
  const { t } = useTranslation();
  if (state === "none") return null;
  const Icon =
    state === "success"
      ? CircleCheck
      : state === "failure"
        ? CircleX
        : LoaderCircle;
  const color =
    state === "success"
      ? "text-success-foreground"
      : state === "failure"
        ? "text-destructive-foreground"
        : "text-muted-foreground";
  return (
    <Icon
      aria-label={t(`workspace:reviews.checks.${state}`)}
      className={`size-3.5 shrink-0 ${color}`}
    />
  );
}
