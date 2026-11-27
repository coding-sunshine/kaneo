import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AddToTicketDialog } from "@/components/chat/add-to-ticket-dialog";
import { buildMessageIssueDraft } from "@/components/chat/message-issue-draft";
import type { ChatMessage } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  useDeleteMessage,
  usePinMessage,
} from "@/hooks/mutations/chat/use-message-mutations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { useCreateIssueStore } from "@/store/create-issue";

type MessageActionsProps = {
  workspaceId: string;
  channelId: string;
  message: ChatMessage;
  isOwn: boolean;
  onEdit: () => void;
};

/**
 * Pin and copy to a ticket for every member who can write; create a ticket
 * with permission to; edit and delete only on your own message.
 */
export function MessageActions({
  workspaceId,
  channelId,
  message,
  isOwn,
  onEdit,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const pin = usePinMessage(workspaceId, channelId);
  const remove = useDeleteMessage(workspaceId, channelId);
  const onError = (error: Error) => toast.error(error.message);
  const pinned = Boolean(message.pinnedAt);
  const { canCreateTasks } = useWorkspacePermission();
  const openWithDraft = useCreateIssueStore((state) => state.openWithDraft);
  const [addingToTicket, setAddingToTicket] = useState(false);

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
            />
          }
          aria-label={t("navigation:chat.messageActions")}
        >
          <MoreHorizontal />
        </MenuTrigger>
        <MenuPopup align="start" className="min-w-40">
          <MenuItem
            onClick={() =>
              pin.mutate(
                { messageId: message.id, pinned: !pinned },
                { onError },
              )
            }
          >
            {pinned ? t("navigation:chat.unpin") : t("navigation:chat.pin")}
          </MenuItem>
          {canCreateTasks() && (
            <MenuItem
              onClick={() =>
                openWithDraft(
                  buildMessageIssueDraft(
                    workspaceId,
                    channelId,
                    message,
                    t("navigation:chat.openInChat"),
                  ),
                )
              }
            >
              {t("navigation:chat.createTicket")}
            </MenuItem>
          )}
          <MenuItem onClick={() => setAddingToTicket(true)}>
            {t("navigation:chat.addToTicket")}
          </MenuItem>
          {isOwn && (
            <>
              <MenuItem onClick={onEdit}>
                {t("navigation:chat.editMessage")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                variant="destructive"
                onClick={() => remove.mutate(message.id, { onError })}
              >
                {t("navigation:chat.deleteMessage")}
              </MenuItem>
            </>
          )}
        </MenuPopup>
      </Menu>
      <AddToTicketDialog
        open={addingToTicket}
        onOpenChange={setAddingToTicket}
        workspaceId={workspaceId}
        channelId={channelId}
        messageId={message.id}
      />
    </>
  );
}
