import { useTranslation } from "react-i18next";
import { CommentComposer } from "@/components/reviews/comment-composer";
import { ConversationTimeline } from "@/components/reviews/conversation-timeline";
import { Markdown } from "@/components/reviews/markdown";
import { Person } from "@/components/reviews/person";
import { PullRequestProperties } from "@/components/reviews/pull-request-properties";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";

export function OverviewTab({
  pullRef,
  pull,
  workspaceId,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance font-semibold text-2xl leading-8">
          {pull.title}
        </h1>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground text-xs">
          <Person author={pull.author} />
          <span aria-hidden>·</span>
          <span className="min-w-0 truncate font-mono">
            {pull.baseRef} ← {pull.headRef}
          </span>
        </p>
      </header>
      <PullRequestProperties
        pullRef={pullRef}
        pull={pull}
        workspaceId={workspaceId}
      />
      {pull.body ? (
        // Linear sets a PR description at its document scale, headings included.
        <div className="kaneo-document-body">
          <Markdown value={pull.body} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("workspace:reviews.detail.noDescription")}
        </p>
      )}
      <section className="flex flex-col gap-4 border-border/60 border-t pt-6">
        <h2 className="font-medium text-sm">
          {t("workspace:reviews.detail.conversation")}
        </h2>
        <ConversationTimeline pullRef={pullRef} />
        <CommentComposer pullRef={pullRef} />
      </section>
    </div>
  );
}
