import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePostMessage } from "@/hooks/mutations/chat/use-post-message";
import { toast } from "@/lib/toast";

type MessageComposerProps = {
  workspaceId: string;
  channelId: string;
  channelName: string;
};

export function MessageComposer({
  workspaceId,
  channelId,
  channelName,
}: MessageComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const post = usePostMessage(workspaceId, channelId);

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
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Textarea
        value={body}
        maxLength={4000}
        rows={2}
        aria-label={t("navigation:chat.messageLabel")}
        placeholder={t("navigation:chat.messagePlaceholder", {
          name: channelName,
        })}
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
