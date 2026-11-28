import { Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuItem } from "@/components/ui/menu";
import { useSaveMessage } from "@/hooks/mutations/chat/use-later-mutations";
import { useSavedMessages } from "@/hooks/queries/chat/use-saved-messages";
import { toast } from "@/lib/toast";

type MessageSaveItemProps = {
  workspaceId: string;
  channelId: string;
  messageId: string;
};

/** Adds the message to the caller's own saved list, or takes it off. */
export function MessageSaveItem(param: MessageSaveItemProps) {
  const { t } = useTranslation();
  const { data: saved = [] } = useSavedMessages(param.workspaceId);
  const save = useSaveMessage(param.workspaceId);
  const isSaved = saved.some((message) => message.id === param.messageId);

  return (
    <MenuItem
      onClick={() =>
        save.mutate(
          { ...param, saved: !isSaved },
          { onError: (error: Error) => toast.error(error.message) },
        )
      }
    >
      <Bookmark />
      {isSaved
        ? t("navigation:chat.unsaveMessage")
        : t("navigation:chat.saveMessage")}
    </MenuItem>
  );
}
