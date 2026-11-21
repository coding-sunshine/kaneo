import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Paperclip, MessageSquareIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { Button } from "@/components/ui/button";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useCreateComment from "@/hooks/mutations/comment/use-create-comment";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type CommentInputProps = {
  taskId: string;
  projectId?: string;
  /** Set to post a reply inside this comment's thread. */
  parentId?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
};

export default function CommentInput({
  taskId,
  projectId,
  parentId,
  autoFocus,
  onCancel,
}: CommentInputProps) {
  const isReply = Boolean(parentId);
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [attachAction, setAttachAction] = useState<(() => void) | null>(null);
  const { mutateAsync: createComment, isPending } = useCreateComment();
  const queryClient = useQueryClient();

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      toast.error(t("activity:comment.cannotBeEmpty"));
      return;
    }

    try {
      await createComment({
        taskId,
        comment: content,
        parentId,
      });

      setContent("");
      onCancel?.();
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });

      toast.success(t("activity:comment.added"), { icon: MessageSquareIcon });
    } catch (error) {
      console.error("Failed to create comment:", error);
      toast.error(t("activity:comment.failedToAdd"));
    }
  }, [content, createComment, onCancel, parentId, queryClient, t, taskId]);

  const handleAttachActionChange = useCallback(
    (nextAttachAction: (() => void) | null) => {
      setAttachAction(() => nextAttachAction);
    },
    [],
  );

  return (
    <div
      className="w-full"
      // The "comment" shortcut focuses the task's main composer, never a reply.
      data-task-action={isReply ? undefined : "comment"}
      onBlur={(event) => {
        // A file dialog takes focus from the window; keep the reply open.
        if (
          onCancel &&
          document.hasFocus() &&
          !content.trim() &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          onCancel();
        }
      }}
    >
      <div
        className={cn(
          !isReply &&
            "rounded-xl border border-border/80 bg-card/70 transition-colors focus-within:border-ring/60 focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--ring)_20%,transparent)]",
        )}
      >
        <CommentEditor
          value={content}
          onChange={setContent}
          placeholder={t(
            isReply
              ? "activity:comment.leaveReply"
              : "activity:comment.leavePlaceholder",
          )}
          taskId={taskId}
          projectId={projectId}
          uploadSurface="comment"
          showQuickAttachButton={false}
          onAttachActionChange={handleAttachActionChange}
          className="[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[3rem] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
          onSubmitShortcut={handleSubmit}
          onCancelShortcut={onCancel}
          autoFocus={autoFocus}
        />
        <div
          className={cn(
            "flex items-center justify-end gap-2 px-2 py-2",
            !isReply && "border-border/70 border-t",
          )}
        >
          <Button
            size="xs"
            variant="ghost"
            onClick={() => attachAction?.()}
            disabled={!attachAction}
            className="text-muted-foreground"
            aria-label={t("activity:comment.attachFile")}
          >
            <Paperclip className="size-3.5" />
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="xs"
                  variant="default"
                  onClick={handleSubmit}
                  disabled={isPending || !content.trim()}
                  className={cn(
                    isPending ||
                      (!content.trim() && "opacity-50 cursor-not-allowed"),
                    content.trim().length > 0 &&
                      "bg-primary text-primary-foreground",
                  )}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex items-center gap-2">
                  {t("activity:comment.submitShortcut")}
                  <ShortcutKeys id="submit" tone="tooltip" />
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
