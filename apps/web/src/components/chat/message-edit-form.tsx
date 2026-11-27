import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEditMessage } from "@/hooks/mutations/chat/use-message-mutations";
import { toast } from "@/lib/toast";

type MessageEditFormProps = {
  workspaceId: string;
  channelId: string;
  message: ChatMessage;
  onDone: () => void;
};

export function MessageEditForm({
  workspaceId,
  channelId,
  message,
  onDone,
}: MessageEditFormProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState(message.body);
  const edit = useEditMessage(workspaceId, channelId);

  const save = () => {
    const text = body.trim();
    if (!text || edit.isPending) return;
    if (text === message.body) return onDone();
    edit.mutate(
      { messageId: message.id, body: text },
      { onSuccess: onDone, onError: (error) => toast.error(error.message) },
    );
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Textarea
        autoFocus
        value={body}
        maxLength={4000}
        rows={2}
        aria-label={t("navigation:chat.editMessage")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDone();
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            save();
          }
        }}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!body.trim() || edit.isPending}
        >
          {t("navigation:chat.save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t("navigation:chat.cancel")}
        </Button>
      </div>
    </form>
  );
}
