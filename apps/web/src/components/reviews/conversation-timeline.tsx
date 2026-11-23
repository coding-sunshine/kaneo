import { useTranslation } from "react-i18next";
import { Markdown } from "@/components/reviews/markdown";
import { Person } from "@/components/reviews/person";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { usePullRequestConversation } from "@/hooks/queries/github-reviews/use-github-reviews";
import { formatRelativeTime } from "@/lib/format";

export function ConversationTimeline({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const conversation = usePullRequestConversation(pullRef);
  if (conversation.isLoading) return <Skeleton className="h-16" />;
  if (conversation.isError || !conversation.data) {
    return (
      <p role="alert" className="text-muted-foreground text-sm">
        {t("workspace:reviews.loadError")}
      </p>
    );
  }
  if (conversation.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("workspace:reviews.detail.noConversation")}
      </p>
    );
  }
  return (
    <>
      {conversation.data.map((entry) => (
        <article
          key={entry.id}
          data-kind={entry.kind}
          className="rounded-lg border p-3"
        >
          <header className="mb-1.5 flex items-center gap-2 text-muted-foreground text-xs">
            <Person author={entry.author} />
            {entry.reviewState && (
              <span className="uppercase tracking-wide">
                {entry.reviewState.replaceAll("_", " ").toLowerCase()}
              </span>
            )}
            {entry.path && (
              <span className="min-w-0 truncate font-mono">
                {entry.path}
                {entry.line ? `:${entry.line}` : ""}
              </span>
            )}
            <span>
              {formatRelativeTime(
                entry.createdAt,
                undefined,
                undefined,
                "short",
              )}
            </span>
          </header>
          {entry.body && <Markdown value={entry.body} />}
        </article>
      ))}
    </>
  );
}
