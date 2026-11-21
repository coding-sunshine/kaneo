import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";
import CommentCard from "./comment-card";
import type { CreatedIssue } from "./comment-created-issues";
import { commentAuthor } from "./comment-author";
import ReplyComposer from "./reply-composer";
import {
  collapsedCount,
  commentHash,
  initialCollapse,
  rememberExpanded,
} from "./thread-collapse";
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
  createdIssues?: CreatedIssue[];
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
  const resolved = Boolean(root.resolvedAt);
  const [collapse, setCollapse] = useState(() =>
    initialCollapse({ root, replies }, window.location.hash, resolved),
  );
  const { expanded } = collapse;
  // Resolving a thread folds it, as in Linear.
  const [wasResolved, setWasResolved] = useState(resolved);
  if (resolved !== wasResolved) {
    setWasResolved(resolved);
    if (resolved) {
      rememberExpanded(root.id, false);
      setCollapse({
        expanded: false,
        hiddenCount: collapsedCount(replies.length),
      });
    }
  }
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
  // An open thread folds its older replies once it grows long.
  const hidden = resolved
    ? replies.filter((reply) => reply.id !== root.resolvingCommentId)
    : replies.slice(0, collapse.hiddenCount);
  const folded = expanded ? [] : hidden;
  const shown = replies.filter((reply) => !folded.includes(reply));
  const showFoldRow = hidden.length > 0 && !(resolved && expanded);
  // Most frequent authors first, as Linear lists them.
  const byAuthor = new Map<string, ThreadComment[]>();
  for (const reply of hidden) {
    const name = authorOf(reply).user.name ?? "";
    byAuthor.set(name, [...(byAuthor.get(name) ?? []), reply]);
  }
  const foldedAuthors = [...byAuthor.values()]
    .sort((a, b) => b.length - a.length)
    .map((group) => authorOf(group[0]).user);
  const names = foldedAuthors.map((author) => author.name ?? "");
  const listedNames =
    names.length - 3 >= 2
      ? [
          ...names.slice(0, 3),
          t("activity:comment.otherAuthors", { count: names.length - 3 }),
        ]
      : names;

  const toggle = () => {
    const next = !expanded;
    rememberExpanded(root.id, next);
    if (next) return setCollapse({ ...collapse, expanded: true });
    // Collapsing drops a link to a reply, so a reload keeps it collapsed.
    const { hash, pathname, search } = window.location;
    if (replies.some((reply) => hash === commentHash(reply.id)))
      window.history.replaceState(window.history.state, "", pathname + search);
    setCollapse({
      expanded: false,
      hiddenCount: collapsedCount(replies.length),
    });
  };

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
        createdIssues={comment.createdIssues}
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
      {showFoldRow && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={
            expanded ? t("activity:comment.collapseThread") : undefined
          }
          className={cn(
            "flex w-full items-center gap-2 border-border/80 border-t px-3 py-2.5 text-left text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:bg-accent/50",
            // Stays in reach while reading a long opened thread.
            expanded &&
              hidden.length >= 2 &&
              "sticky top-0 z-10 bg-background bg-linear-to-b from-foreground/2 to-foreground/2",
          )}
        >
          {expanded ? (
            <span className="flex-1">{t("activity:comment.collapse")}</span>
          ) : (
            <>
              <span aria-hidden className="flex -space-x-1">
                {foldedAuthors.slice(0, 5).map((author) => (
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
              <span className="flex-1 truncate">
                {t("activity:comment.foldedReplies", {
                  count: hidden.length,
                  names: new Intl.ListFormat(undefined, {
                    type: "conjunction",
                  }).format(listedNames),
                })}
              </span>
            </>
          )}
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
