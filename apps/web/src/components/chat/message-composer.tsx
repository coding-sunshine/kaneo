import { useTranslation } from "react-i18next";
import { ChatFileButton } from "@/components/chat/chat-file-button";
import { MentionPicker } from "@/components/chat/mention-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePostMessage } from "@/hooks/mutations/chat/use-post-message";
import { useSendChatFile } from "@/hooks/mutations/chat/use-send-chat-file";
import { useChannelDraft } from "@/hooks/use-channel-draft";
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
  const { body, setBody, beforeSend, clear } = useChannelDraft(
    workspaceId,
    channelId,
  );
  const post = usePostMessage(workspaceId, channelId);
  const sendFile = useSendChatFile(workspaceId, channelId);
  const busy = post.isPending || sendFile.isPending;

  const send = async () => {
    const text = body.trim();
    if (!text || busy) return;
    await beforeSend();
    post.mutate(text, {
      onSuccess: () => {
        clear();
        onPosted?.();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  // The typed text goes with the files, as their one message.
  const attach = async (files: File[]) => {
    await beforeSend();
    sendFile.mutate(
      { files, body: body.trim() || undefined },
      {
        onSuccess: () => {
          clear();
          onPosted?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <form
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
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
            void send();
          }
        }}
      />
      <MentionPicker
        workspaceId={workspaceId}
        onPick={(token) =>
          setBody(`${body}${body && !/\s$/.test(body) ? " " : ""}${token} `)
        }
      />
      <ChatFileButton disabled={busy} onPick={attach} />
      <Button type="submit" size="sm" disabled={!body.trim() || busy}>
        {t("navigation:chat.send")}
      </Button>
    </form>
  );
}
