import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WorkProjectComment } from "@/fetchers/work-project/types";
import {
  useDeleteWorkProjectComment,
  useEditWorkProjectComment,
} from "@/hooks/mutations/work-project/use-work-project-comment-mutations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export function WorkProjectCommentItem({
  comment,
}: {
  comment: WorkProjectComment;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useWorkspacePermission();
  const { mutateAsync: edit } = useEditWorkProjectComment(
    comment.workProjectId,
  );
  const { mutateAsync: remove } = useDeleteWorkProjectComment(
    comment.workProjectId,
  );
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const isAuthor = Boolean(user?.id) && user?.id === comment.userId;
  const fail = (error: unknown) =>
    toast.error(
      error instanceof Error
        ? error.message
        : t("workspace:workProject.comments.error"),
    );

  return (
    <li className="space-y-1 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="font-medium text-foreground">{comment.userName}</span>
        <time dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleDateString()}
        </time>
        {(isAuthor || isAdmin) && (
          <span className="ml-auto flex gap-1">
            {isAuthor && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t("workspace:workProject.comments.edit")}
                onClick={() => setEditing(true)}
              >
                <Pencil />
              </Button>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("workspace:workProject.comments.delete")}
              onClick={async () => {
                if (
                  !window.confirm(
                    t("workspace:workProject.comments.deleteConfirm"),
                  )
                )
                  return;
                try {
                  await remove(comment.id);
                } catch (error) {
                  fail(error);
                }
              }}
            >
              <Trash2 />
            </Button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            aria-label={t("workspace:workProject.comments.edit")}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!content.trim()}
              onClick={async () => {
                try {
                  await edit({ id: comment.id, content: content.trim() });
                  setEditing(false);
                } catch (error) {
                  fail(error);
                }
              }}
            >
              {t("workspace:workProject.comments.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setContent(comment.content);
                setEditing(false);
              }}
            >
              {t("workspace:workProject.comments.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <CommentEditor value={comment.content} readOnly />
      )}
    </li>
  );
}
