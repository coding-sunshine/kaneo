import { Check, CircleDot, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  PullRef,
  PullRequestChecks,
} from "@/fetchers/github-reviews/github-reviews";
import { usePullRequestChecks } from "@/hooks/queries/github-reviews/use-github-reviews";
import { formatDuration } from "@/lib/format-duration";

type Check = PullRequestChecks["checks"][number];
type State = Check["state"];

// Linear lists what needs attention first.
const SECTIONS: State[] = ["failure", "pending", "success"];
const SECTION_KEY = {
  failure: "failed",
  pending: "pending",
  success: "successful",
} as const;

function CheckIcon({ state }: { state: State }) {
  if (state === "success") {
    return <Check className="size-4 text-success-foreground" />;
  }
  if (state === "failure") {
    return <X className="size-4 text-destructive-foreground" />;
  }
  return <CircleDot className="size-4 text-warning-foreground" />;
}

export function ChecksList({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const checks = usePullRequestChecks(pullRef);
  const [query, setQuery] = useState("");
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
  const needle = query.trim().toLowerCase();
  const shown = checks.data.checks.filter((check) =>
    check.name.toLowerCase().includes(needle),
  );

  return (
    <div className="flex flex-col">
      <Input
        size="sm"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("workspace:reviews.checksPopover.placeholder")}
        aria-label={t("workspace:reviews.checksPopover.placeholder")}
      />
      <div className="flex max-h-80 flex-col overflow-y-auto">
        {shown.length === 0 && (
          <p className="px-2 py-2 text-muted-foreground text-sm">
            {t("workspace:reviews.checksPopover.noMatch")}
          </p>
        )}
        {SECTIONS.map((state) => {
          const rows = shown.filter((check) => check.state === state);
          if (rows.length === 0) return null;
          return (
            <section key={state} aria-label={state}>
              <h3 className="px-2 pt-2.5 pb-1 text-muted-foreground text-xs">
                {t(`workspace:reviews.checksPopover.${SECTION_KEY[state]}`, {
                  count: rows.length,
                })}
              </h3>
              <ul>
                {rows.map((check) => (
                  <li
                    key={`${check.name}-${check.url}`}
                    data-state={check.state}
                    className="text-sm"
                  >
                    <CheckRow check={check} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const row = (
    <>
      <CheckIcon state={check.state} />
      <span className="min-w-0 flex-1 truncate">{check.name}</span>
      {check.durationSeconds != null && (
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {formatDuration(check.durationSeconds)}
        </span>
      )}
    </>
  );
  const className = "flex h-8 items-center gap-2.5 rounded-sm px-2";
  return check.url ? (
    <a
      href={check.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:bg-accent`}
    >
      {row}
    </a>
  ) : (
    <div className={className}>{row}</div>
  );
}
