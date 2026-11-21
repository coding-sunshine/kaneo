import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderGit, MessageSquareIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { GithubIcon } from "@/components/icons/github-icon";
import { GitlabIcon } from "@/components/icons/gitlab-icon";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useDeleteComment from "@/hooks/mutations/comment/use-delete-comment";
import useUpdateComment from "@/hooks/mutations/comment/use-update-comment";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import CommentActions from "./comment-actions";
import CommentReactions from "./comment-reactions";
import DeleteCommentDialog from "./delete-comment-dialog";
import type { Reaction } from "./toggle-reaction";

const forges = {
  github: { name: "GitHub", Icon: GithubIcon },
  gitea: { name: "Gitea", Icon: FolderGit },
  gitlab: { name: "GitLab", Icon: GitlabIcon },
} as const;

function forgeOf(externalSource: string | null | undefined) {
  if (!externalSource) {
    return null;
  }
  return forges[externalSource as keyof typeof forges] ?? null;
}

type CommentCardProps = {
  commentId: string;
  taskId: string;
  content: string;
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  createdAt: string;
  importedBy?: string;
  externalSource?: string | null;
  externalUrl?: string | null;
  /** A reply indents its body under the author's name. */
  variant?: "root" | "reply";
  reactions?: Reaction[];
  threadResolved?: boolean;
  /** Marks the reply that resolved its thread. */
  isResolution?: boolean;
  /** Replies in this root comment's thread; deleting it deletes them too. */
  replyCount?: number;
};

export default function CommentCard({
  commentId,
  taskId,
  content,
  user,
  createdAt,
  externalSource,
  externalUrl,
  importedBy,
  variant = "root",
  reactions = [],
  threadResolved = false,
  isResolution = false,
  replyCount = 0,
}: CommentCardProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const { mutateAsync: updateComment, isPending } = useUpdateComment();
  const queryClient = useQueryClient();
  const { mutate: deleteComment } = useDeleteComment(taskId);
  const [contextPoint, setContextPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [confirmEmptyDelete, setConfirmEmptyDelete] = useState(false);

  const canEdit = currentUser?.id === user?.id;
  const forge = forgeOf(externalSource);
  const sourceName = forge
    ? forge.name
    : externalSource === "planka"
      ? "Planka"
      : externalSource === "trello"
        ? "Trello"
        : externalSource === "jira"
          ? "Jira"
          : externalSource === "plane"
            ? "Plane"
            : externalSource === "linear"
              ? "Linear"
              : externalSource === "kaneo"
                ? "Kaneo"
                : externalSource;
  // Gitea and GitLab profile URLs depend on the instance.
  const githubProfileUrl =
    forge?.name === "GitHub" && user?.name
      ? `https://github.com/${user.name}`
      : null;
  const commentUrl = externalUrl || null;
  const fullTimestamp = formatDateTime(createdAt);

  const handleEdit = useCallback(() => {
    setEditedContent(content);
    setIsEditing(true);
  }, [content]);

  const handleCancel = useCallback(() => {
    setEditedContent(content);
    setIsEditing(false);
  }, [content]);

  const handleSave = useCallback(async () => {
    // Linear treats a save that empties the comment as a delete, after asking.
    if (!editedContent.trim()) {
      setConfirmEmptyDelete(true);
      return;
    }

    if (!currentUser?.id) {
      toast.error(t("activity:comment.mustBeLoggedInToEdit"));
      return;
    }

    try {
      await updateComment({
        activityId: commentId,
        comment: editedContent,
      });

      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
      toast.success(t("activity:comment.updated"), { icon: MessageSquareIcon });
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error(t("activity:comment.failedToUpdate"));
    }
  }, [
    commentId,
    currentUser?.id,
    editedContent,
    queryClient,
    t,
    taskId,
    updateComment,
  ]);

  return (
    <TooltipProvider>
      <div
        className="group/comment relative w-full"
        onContextMenu={(event) => {
          // Keep the browser's own menu for links, and while editing.
          if (isEditing || (event.target as Element).closest("a[href]")) return;
          event.preventDefault();
          setContextPoint({ x: event.clientX, y: event.clientY });
        }}
      >
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
          <HoverCard>
            <HoverCardTrigger>
              <div className="flex cursor-pointer items-center gap-2">
                <Avatar className="size-5">
                  <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                  <AvatarFallback className="bg-muted font-semibold text-[9px]">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-[13px] text-foreground transition-colors hover:text-foreground/80">
                  {user?.name}
                </span>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-64 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-none">
                    {user?.name}
                  </p>
                  {user?.email && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                  {forge && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <forge.Icon className="size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {forge.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {githubProfileUrl && (
                <a
                  href={githubProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="size-3" />
                  {t("activity:comment.viewGithubProfile")}
                </a>
              )}
            </HoverCardContent>
          </HoverCard>

          {sourceName && (
            <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
              {t("activity:comment.importedFrom", { source: sourceName })}
              {importedBy &&
                ` · ${t("activity:comment.importedBy", { name: importedBy })}`}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="cursor-default text-xs text-muted-foreground/60 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={fullTimestamp}
                title={fullTimestamp}
              >
                <time dateTime={createdAt}>
                  {formatRelativeTime(
                    createdAt,
                    undefined,
                    new Date(),
                    "narrow",
                  )}
                </time>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{fullTimestamp}</p>
            </TooltipContent>
          </Tooltip>
          {isResolution && (
            <span className="font-medium text-green-600 text-xs dark:text-green-500">
              {t("activity:comment.resolution")}
            </span>
          )}

          {commentUrl && forge && (
            <>
              <span className="text-xs text-muted-foreground/40">·</span>
              <a
                href={commentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <forge.Icon className="size-3" />
                {t("activity:comment.commentedOnForge", { forge: forge.name })}
              </a>
            </>
          )}
        </div>

        {!isEditing && (
          <CommentActions
            commentId={commentId}
            taskId={taskId}
            content={content}
            isReply={variant === "reply"}
            threadResolved={threadResolved}
            canEdit={canEdit}
            replyCount={replyCount}
            onEdit={handleEdit}
            contextPoint={contextPoint}
          />
        )}

        <div className="pt-0.5">
          <CommentEditor
            value={isEditing ? editedContent : content}
            onChange={isEditing ? setEditedContent : undefined}
            placeholder={t("activity:comment.editPlaceholder")}
            taskId={taskId}
            uploadSurface="comment"
            className={
              isEditing
                ? "[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[3rem] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-2.5 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
                : cn(
                    "kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:pt-1.5 [&_.kaneo-comment-editor-content_.ProseMirror]:pr-3.5",
                    // Linear aligns a top-level comment's body with its avatar
                    // and indents a reply's body under the author's name.
                    variant === "reply"
                      ? "[&_.kaneo-comment-editor-content_.ProseMirror]:pl-10"
                      : "[&_.kaneo-comment-editor-content_.ProseMirror]:pl-3",
                    reactions.length > 0
                      ? "[&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
                      : "[&_.kaneo-comment-editor-content_.ProseMirror]:pb-3.5",
                  )
            }
            autoFocus={isEditing}
            readOnly={!isEditing}
            onSubmitShortcut={isEditing ? handleSave : undefined}
            onCancelShortcut={isEditing ? handleCancel : undefined}
          />
        </div>

        {reactions.length > 0 && !isEditing && (
          <CommentReactions
            commentId={commentId}
            taskId={taskId}
            reactions={reactions}
            className={cn("pr-3 pb-3", variant === "reply" ? "pl-10" : "pl-3")}
          />
        )}

        {isEditing && (
          <div className="flex items-center justify-end gap-2 border-border/70 border-t bg-card/60 px-3 py-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
              className="h-7 px-2.5 text-xs"
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="h-7 px-2.5 text-xs"
            >
              {t("activity:comment.save")}
            </Button>
          </div>
        )}
        <DeleteCommentDialog
          open={confirmEmptyDelete}
          onOpenChange={setConfirmEmptyDelete}
          hasReplies={replyCount > 0}
          onConfirm={() => deleteComment({ activityId: commentId })}
        />
      </div>
    </TooltipProvider>
  );
}
