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
import { useAddChannelMember } from "@/hooks/mutations/chat/use-channel-mutations";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { toast } from "@/lib/toast";

type AddMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channel: ChatChannelDetail;
};

/** Lists workspace members who are not in the channel yet. */
export function AddMemberDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: AddMemberDialogProps) {
  const { t } = useTranslation();
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const add = useAddChannelMember(workspaceId, channel.id);
  const candidates = (data?.members ?? []).filter(
    (member) => !channel.memberIds.includes(member.userId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t("navigation:chat.addMemberTitle", { name: channel.name })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("navigation:chat.everyoneIsIn")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {candidates.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate">{member.user.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={add.isPending}
                    onClick={() =>
                      add.mutate(member.userId, {
                        onError: (error) => toast.error(error.message),
                      })
                    }
                  >
                    {t("navigation:chat.add")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
