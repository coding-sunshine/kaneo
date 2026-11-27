import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOpenDirectMessage } from "@/hooks/mutations/chat/use-open-direct-message";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { toast } from "@/lib/toast";

type StartDirectMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

/** Pick people to talk with; the same people reopen the same conversation. */
export function StartDirectMessageDialog({
  open,
  onOpenChange,
  workspaceId,
}: StartDirectMessageDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const openDirect = useOpenDirectMessage(workspaceId);
  const [picked, setPicked] = useState<string[]>([]);
  const others = (data?.members ?? []).filter(
    (member) => member.userId !== user?.id,
  );

  const toggle = (userId: string, checked: boolean) =>
    setPicked((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
    );

  const start = () => {
    if (picked.length === 0 || openDirect.isPending) return;
    openDirect.mutate(picked, {
      onSuccess: (channel) => {
        setPicked([]);
        onOpenChange(false);
        navigate({
          to: "/dashboard/workspace/$workspaceId/channels/$channelId",
          params: { workspaceId, channelId: channel.id },
        });
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:chat.directTitle")}</DialogTitle>
          <DialogDescription>
            {t("navigation:chat.directHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("navigation:chat.noOneElse")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {others.map((member) => (
                <li key={member.userId}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={picked.includes(member.userId)}
                      onCheckedChange={(checked) =>
                        toggle(member.userId, checked)
                      }
                    />
                    <span className="min-w-0 truncate">{member.user.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={picked.length === 0 || openDirect.isPending}
            onClick={start}
          >
            {t("navigation:chat.openDirect")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
