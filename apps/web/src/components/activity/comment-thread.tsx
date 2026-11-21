import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { getInitials } from "@/lib/get-initials";
import CommentCard from "./comment-card";
import { commentAuthor } from "./comment-author";
import ReplyComposer from "./reply-composer";
import type { Reaction } from "./toggle-reaction";

export type ThreadComment = {
  id: string;
  taskId: string;
  content: string | null;
  createdAt: string;
  userId: string | null;
  externalSource?: string | null;
  externalUrl?: string | null;
  externalUserName?: string | null;
  externalUserAvatar?: string | null;
  resolvedAt?: string | null;
  resolvingCommentId?: string | null;
  subscribedToThread?: boolean | null;
  reactions?: Reaction[];
};

type CommentThreadProps = {
  root: ThreadComment;
  replies: ThreadComment[];
};

export default function CommentThread({ root, replies }: CommentThreadProps) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: members } = useGetWorkspaceUsers({
    workspaceId: workspace?.id,
  });
  const [expanded, setExpanded] = useState(false);
  const resolved = Boolean(root.resolvedAt);
  // "r" replies to the thread under the pointer or holding focus. Only that
  // thread registers, since the shortcut registry runs a single handler.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [replyRequest, setReplyRequest] = useState(0);
  useShortcut("replyToComment", () => setReplyRequest((n) => n + 1), {
    enabled: (hovered || focused) && !resolved,
  });
  const labels = {
    someone: t("common:people.someone"),
    externalUser: t("activity:githubUser"),
  };
  const authorOf = (comment: ThreadComment) =>
    commentAuthor(comment, members, labels);

  // A resolved thread folds every reply except the one that resolved it.
  const folded =
    resolved && !expanded
      ? replies.filter((reply) => reply.id !== root.resolvingCommentId)
      : [];
  const shown = replies.filter((reply) => !folded.includes(reply));
  const foldedAuthors = [
    ...new Map(
      folded.map((reply) => {
        const { user } = authorOf(reply);
        return [user.name ?? "", user] as const;
      }),
    ).values(),
  ];

  const card = (comment: ThreadComment, variant: "root" | "reply") => {
    const { user, importedBy } = authorOf(comment);
    return (
      <CommentCard
        variant={variant}
        commentId={comment.id}
        taskId={comment.taskId}
        content={comment.content || ""}
        user={user}
        createdAt={comment.createdAt}
        importedBy={importedBy}
        externalSource={comment.externalSource}
        externalUrl={comment.externalUrl}
        reactions={comment.reactions}
        threadResolved={resolved}
        threadSubscribed={root.subscribedToThread ?? null}
        isResolution={resolved && comment.id === root.resolvingCommentId}
        replyCount={variant === "root" ? replies.length : 0}
      />
    );
  };

  return (
    <div
      id={`comment-${root.id}`}
      className="w-full scroll-mt-16 rounded-lg border border-border/80 bg-foreground/2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      {card(root, "root")}
      {folded.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2 border-border/80 border-t px-3 py-2.5 text-left text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:bg-accent/50"
        >
          <span aria-hidden className="flex -space-x-1">
            {foldedAuthors.slice(0, 3).map((author) => (
              <Avatar
                key={author.name}
                className="size-5 ring-2 ring-background"
              >
                <AvatarImage src={author.image ?? ""} alt="" />
                <AvatarFallback className="bg-muted font-semibold text-[9px]">
                  {getInitials(author.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </span>
          <span className="flex-1">
            {t("activity:comment.foldedReplies", {
              count: folded.length,
              names: new Intl.ListFormat(undefined, {
                type: "conjunction",
              }).format(foldedAuthors.map((author) => author.name ?? "")),
            })}
          </span>
          <ChevronsUpDown aria-hidden className="size-3.5" />
        </button>
      )}
      {shown.map((reply) => (
        <div
          key={reply.id}
          id={`comment-${reply.id}`}
          className="scroll-mt-16 border-border/80 border-t"
        >
          {card(reply, "reply")}
        </div>
      ))}
      {!resolved && (
        <ReplyComposer
          taskId={root.taskId}
          parentId={root.id}
          focusRequest={replyRequest}
        />
      )}
    </div>
  );
}
