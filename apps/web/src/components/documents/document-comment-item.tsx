import { Check, Ellipsis, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type {
  DocumentComment,
  DocumentDetail,
} from "@/fetchers/document/documents";
import {
  useDeleteDocumentComment,
  useUpdateDocumentComment,
} from "@/hooks/mutations/document/use-document-mutations";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import { DocumentCommentComposer } from "./document-comment-composer";

type DocumentCommentItemProps = {
  document: DocumentDetail;
  comment: DocumentComment;
  /** Only a thread's first comment resolves the thread. */
  isRoot: boolean;
};

const viewerClass =
  "kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-1 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-0 [&_.kaneo-comment-editor-content_.ProseMirror]:text-[13px]";

/** One comment: author, time, resolve and options, then the body. */
export function DocumentCommentItem({
  document,
  comment,
  isRoot,
}: DocumentCommentItemProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { workspaceId, id } = document;
  const update = useUpdateDocumentComment(workspaceId, id);
  const remove = useDeleteDocumentComment(workspaceId, id);
  const [editing, setEditing] = useState(false);
  const mine = Boolean(user?.id) && comment.userId === user?.id;
  const canComment = document.role !== "view";
  const canDelete = mine || document.role === "owner";
  const resolved = Boolean(comment.resolvedAt);
  const onError = (error: Error) => toast.error(error.message);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Avatar className="size-5">
          <AvatarImage src={comment.userImage ?? ""} alt="" />
          <AvatarFallback className="bg-muted font-semibold text-[9px]">
            {getInitials(comment.userName ?? "")}
          </AvatarFallback>
        </Avatar>
        <span className="truncate font-medium text-[13px]">
          {comment.userName}
        </span>
        <time
          dateTime={comment.createdAt}
          title={formatDateTime(comment.createdAt)}
          className="shrink-0 text-muted-foreground text-xs"
        >
          {formatRelativeTime(comment.createdAt)}
        </time>
        <span className="ms-auto flex items-center">
          {isRoot && canComment && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                resolved
                  ? t("navigation:documents.comments.reopen")
                  : t("navigation:documents.comments.resolve")
              }
              onClick={() =>
                update.mutate(
                  { commentId: comment.id, resolved: !resolved },
                  { onError },
                )
              }
              className="text-muted-foreground"
            >
              {resolved ? <RotateCcw aria-hidden /> : <Check aria-hidden />}
            </Button>
          )}
          {(mine || canDelete) && (
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("navigation:documents.comments.options")}
                    className="text-muted-foreground"
                  />
                }
              >
                <Ellipsis aria-hidden />
              </MenuTrigger>
              <MenuPopup align="end">
                {mine && (
                  <MenuItem onClick={() => setEditing(true)}>
                    {t("navigation:documents.comments.edit")}
                  </MenuItem>
                )}
                {canDelete && (
                  <MenuItem
                    variant="destructive"
                    onClick={() => remove.mutate(comment.id, { onError })}
                  >
                    {t("navigation:documents.comments.delete")}
                  </MenuItem>
                )}
              </MenuPopup>
            </Menu>
          )}
        </span>
      </div>
      {editing ? (
        <DocumentCommentComposer
          autoFocus
          initialValue={comment.content}
          placeholder={t("navigation:documents.comments.placeholder")}
          onCancel={() => setEditing(false)}
          onSubmit={(content) =>
            update
              .mutateAsync({ commentId: comment.id, content })
              .then(() => setEditing(false))
          }
          className="mt-1"
        />
      ) : (
        <CommentEditor
          value={comment.content}
          readOnly
          className={viewerClass}
        />
      )}
    </div>
  );
}
