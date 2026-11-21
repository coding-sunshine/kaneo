import {
  Check,
  Copy,
  Link,
  MoreHorizontal,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import useDeleteComment from "@/hooks/mutations/comment/use-delete-comment";
import useSetCommentReaction from "@/hooks/mutations/comment/use-set-comment-reaction";
import useSetCommentThreadResolved from "@/hooks/mutations/comment/use-set-comment-thread-resolved";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import AddReactionButton from "./add-reaction-button";

type CommentActionsProps = {
  commentId: string;
  taskId: string;
  content: string;
  isReply: boolean;
  threadResolved: boolean;
  canEdit: boolean;
  onEdit: () => void;
};

export function commentLink(commentId: string) {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#comment-${commentId}`;
}

export default function CommentActions({
  commentId,
  taskId,
  content,
  isReply,
  threadResolved,
  canEdit,
  onEdit,
}: CommentActionsProps) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { mutate: setReaction } = useSetCommentReaction(taskId);
  const { mutate: setResolved } = useSetCommentThreadResolved(taskId);
  const { mutate: deleteComment } = useDeleteComment(taskId);

  const copy = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  };

  return (
    <div
      className={cn(
        "absolute top-2 right-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/comment:opacity-100",
        (pickerOpen || menuOpen) && "opacity-100",
      )}
    >
      <AddReactionButton
        onOpenChange={setPickerOpen}
        onSelect={(emoji) =>
          setReaction({ activityId: commentId, emoji, reacted: true })
        }
      />
      <Menu open={menuOpen} onOpenChange={setMenuOpen}>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("activity:comment.actions")}
              className="h-6 w-6 rounded-md p-0 text-muted-foreground hover:text-foreground"
            />
          }
        >
          <MoreHorizontal className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-56">
          {canEdit && (
            <>
              <MenuItem onClick={onEdit}>
                <Pencil />
                {t("activity:comment.editMenu")}
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem
            onClick={() =>
              setResolved(
                { activityId: commentId, resolved: !threadResolved },
                {
                  onError: () =>
                    toast.error(t("activity:comment.failedToResolve")),
                },
              )
            }
          >
            {threadResolved ? <Undo2 /> : <Check />}
            {threadResolved
              ? t("activity:comment.unresolveThread")
              : isReply
                ? t("activity:comment.resolveThreadWithComment")
                : t("activity:comment.resolveThread")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onClick={() =>
              void copy(
                commentLink(commentId),
                t("activity:comment.linkCopied"),
              )
            }
          >
            <Link />
            {t("activity:comment.copyLink")}
          </MenuItem>
          <MenuItem
            onClick={() =>
              void copy(content, t("activity:comment.markdownCopied"))
            }
          >
            <Copy />
            {t("activity:comment.copyMarkdown")}
          </MenuItem>
          {canEdit && (
            <>
              <MenuSeparator />
              <MenuItem
                onClick={() => deleteComment({ activityId: commentId })}
              >
                <Trash2 />
                {t("common:actions.delete")}
              </MenuItem>
            </>
          )}
        </MenuPopup>
      </Menu>
    </div>
  );
}
