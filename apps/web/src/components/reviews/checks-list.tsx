import { Check, CircleDot, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { usePullRequestChecks } from "@/hooks/queries/github-reviews/use-github-reviews";

export function ChecksList({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const checks = usePullRequestChecks(pullRef);
  if (checks.isLoading) return <Skeleton className="h-16" />;
  if (checks.isError || !checks.data) {
    return (
      <p role="alert" className="text-muted-foreground text-sm">
        {t("workspace:reviews.loadError")}
      </p>
    );
  }
  if (checks.data.checks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("workspace:reviews.detail.noChecks")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col px-3">
      {checks.data.checks.map((check) => (
        <li
          key={`${check.name}-${check.url}`}
          data-state={check.state}
          className="flex h-9 items-center gap-2.5 border-border/50 border-b text-sm last:border-b-0"
        >
          {check.state === "success" ? (
            <Check className="size-4 text-success-foreground" />
          ) : check.state === "failure" ? (
            <X className="size-4 text-destructive-foreground" />
          ) : (
            <CircleDot className="size-4 text-warning-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">{check.name}</span>
          {check.url && (
            <a
              href={check.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              {t("workspace:reviews.detail.details")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
