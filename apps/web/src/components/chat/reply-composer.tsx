import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePostReply } from "@/hooks/mutations/chat/use-post-reply";
import { toast } from "@/lib/toast";

type ReplyComposerProps = {
  workspaceId: string;
  channelId: string;
  parentId: string;
  autoFocus?: boolean;
};

/** The box under a thread: Enter sends the reply, Shift+Enter breaks the line. */
export function ReplyComposer({
  workspaceId,
  channelId,
  parentId,
  autoFocus = false,
}: ReplyComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const post = usePostReply(workspaceId, channelId, parentId);

  const send = () => {
    const text = body.trim();
    if (!text || post.isPending) return;
    post.mutate(text, {
      onSuccess: () => setBody(""),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Textarea
        value={body}
        maxLength={4000}
        rows={1}
        // oxlint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        aria-label={t("navigation:chat.replyLabel")}
        placeholder={t("navigation:chat.replyPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <Button type="submit" size="sm" disabled={!body.trim() || post.isPending}>
        {t("navigation:chat.send")}
      </Button>
    </form>
  );
}
