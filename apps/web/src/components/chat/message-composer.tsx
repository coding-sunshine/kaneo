import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatFileButton } from "@/components/chat/chat-file-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePostMessage } from "@/hooks/mutations/chat/use-post-message";
import { useSendChatFile } from "@/hooks/mutations/chat/use-send-chat-file";
import { toast } from "@/lib/toast";

type MessageComposerProps = {
  workspaceId: string;
  channelId: string;
  channelName: string;
  onPosted?: () => void;
};

export function MessageComposer({
  workspaceId,
  channelId,
  channelName,
  onPosted,
}: MessageComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const post = usePostMessage(workspaceId, channelId);
  const sendFile = useSendChatFile(workspaceId, channelId);
  const busy = post.isPending || sendFile.isPending;

  const send = () => {
    const text = body.trim();
    if (!text || busy) return;
    post.mutate(text, {
      onSuccess: () => {
        setBody("");
        onPosted?.();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  // The typed text goes with the file, as its message.
  const attach = (file: File) =>
    sendFile.mutate(
      { file, body: body.trim() || undefined },
      {
        onSuccess: () => {
          setBody("");
          onPosted?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );

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
      <ChatFileButton disabled={busy} onPick={attach} />
      <Button type="submit" size="sm" disabled={!body.trim() || busy}>
        {t("navigation:chat.send")}
      </Button>
    </form>
  );
}
