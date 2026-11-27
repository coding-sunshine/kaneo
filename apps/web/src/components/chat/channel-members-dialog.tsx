import { useTranslation } from "react-i18next";
import type { ChatChannelDetail } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRemoveChannelMember } from "@/hooks/mutations/chat/use-channel-mutations";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

type ChannelMembersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channel: ChatChannelDetail;
};

/** Lets an admin take people out of a channel. They lose it at once. */
export function ChannelMembersDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: ChannelMembersDialogProps) {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const remove = useRemoveChannelMember(workspaceId, channel.id);
  const names = new Map(
    (data?.members ?? []).map((member) => [member.userId, member.user.name]),
  );
  const others = channel.memberIds.filter((id) => id !== session?.user.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t("navigation:chat.manageMembersTitle", { name: channel.name })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("navigation:chat.onlyYou")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {others.map((userId) => {
                const name =
                  names.get(userId) ?? t("navigation:chat.deletedUser");
                return (
                  <li
                    key={userId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={remove.isPending}
                      aria-label={t("navigation:chat.removeMemberAria", {
                        name,
                      })}
                      onClick={() =>
                        remove.mutate(userId, {
                          onError: (error) => toast.error(error.message),
                        })
                      }
                    >
                      {t("navigation:chat.remove")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
