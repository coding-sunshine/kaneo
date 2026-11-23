import { useTranslation } from "react-i18next";
import { ChecksList } from "@/components/reviews/checks-list";
import { CommentComposer } from "@/components/reviews/comment-composer";
import { ConversationTimeline } from "@/components/reviews/conversation-timeline";
import { Markdown } from "@/components/reviews/markdown";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";

export function OverviewTab({
  pullRef,
  pull,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      {pull.labels.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {pull.labels.map((label) => (
            <li
              key={label.name}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: `#${label.color}` }}
              />
              {label.name}
            </li>
          ))}
        </ul>
      )}
      {pull.body ? (
        <Markdown value={pull.body} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("workspace:reviews.detail.noDescription")}
        </p>
      )}
      <h2 className="font-medium text-sm">
        {t("workspace:reviews.detail.tabs.checks")}
      </h2>
      <ChecksList pullRef={pullRef} />
      <h2 className="font-medium text-sm">
        {t("workspace:reviews.detail.conversation")}
      </h2>
      <ConversationTimeline pullRef={pullRef} />
      <CommentComposer pullRef={pullRef} />
    </div>
  );
}
