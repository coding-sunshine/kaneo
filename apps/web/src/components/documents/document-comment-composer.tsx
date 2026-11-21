import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type DocumentCommentComposerProps = {
  placeholder: string;
  onSubmit: (content: string) => Promise<unknown>;
  initialValue?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
  className?: string;
};

const editorClass =
  "min-w-0 flex-1 [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-60 [&_.kaneo-comment-editor-content_.ProseMirror]:min-h-0 [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:py-1 [&_.kaneo-comment-editor-content_.ProseMirror]:text-[13px]";

/** A comment box with Linear's round send arrow; ⌘↵ also sends. */
export function DocumentCommentComposer({
  placeholder,
  onSubmit,
  initialValue = "",
  onCancel,
  autoFocus,
  className,
}: DocumentCommentComposerProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  // The editor hydrates once, so a new key is how it empties after sending.
  const [round, setRound] = useState(0);
  const [pending, setPending] = useState(false);
  const empty = !value.trim();

  const submit = async () => {
    if (empty || pending) return;
    setPending(true);
    try {
      await onSubmit(value.trim());
      setValue("");
      setRound((n) => n + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex items-end gap-1", className)}>
      <CommentEditor
        key={round}
        value={round ? "" : initialValue}
        onChange={setValue}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onSubmitShortcut={submit}
        onCancelShortcut={onCancel}
        className={editorClass}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("navigation:documents.comments.send")}
        disabled={empty || pending}
        onClick={submit}
        className="shrink-0 rounded-full"
      >
        <ArrowUp aria-hidden />
      </Button>
    </div>
  );
}
