import { Markdown } from "@/components/reviews/markdown";
import { Person } from "@/components/reviews/person";
import type { ConversationEntry } from "@/fetchers/github-reviews/github-reviews";
import { formatRelativeTime } from "@/lib/format";

export function InlineComments({
  comments,
}: {
  comments: ConversationEntry[];
}) {
  return (
    <div className="flex flex-col gap-2 border-y bg-muted/30 px-3 py-2 font-sans">
      {comments.map((comment) => (
        <div key={comment.id} data-testid="inline-comment">
          <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
            <Person author={comment.author} />
            <span>
              {formatRelativeTime(
                comment.createdAt,
                undefined,
                undefined,
                "short",
              )}
            </span>
          </div>
          <Markdown value={comment.body} />
        </div>
      ))}
    </div>
  );
}
