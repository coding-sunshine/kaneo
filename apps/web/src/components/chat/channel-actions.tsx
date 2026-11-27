import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AddMemberDialog } from "@/components/chat/add-member-dialog";
import { ChannelMembersDialog } from "@/components/chat/channel-members-dialog";
import { ChannelTopicDialog } from "@/components/chat/channel-topic-dialog";
import type { ChatChannelDetail } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  useLeaveChannel,
  useUpdateChannel,
} from "@/hooks/mutations/chat/use-channel-mutations";
import useGetMyProjectAccess from "@/hooks/queries/workspace-users/use-get-my-project-access";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

/**
 * Member actions: topic, add or remove people, archive or unarchive, leave.
 * A guest may only leave; admins manage who is in the channel.
 */
export function ChannelActions({
  workspaceId,
  channel,
}: {
  workspaceId: string;
  channel: ChatChannelDetail;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"topic" | "members" | "manage" | null>(
    null,
  );
  const isGuest = useGetMyProjectAccess(workspaceId).data?.guest ?? false;
  const canManageMembers = useWorkspacePermission().canUpdateMembers();
  const update = useUpdateChannel(workspaceId, channel.id);
  const leave = useLeaveChannel(workspaceId, channel.id);
  const onError = (error: Error) => toast.error(error.message);
  const archived = Boolean(channel.archivedAt);

  if (!channel.isMember) return null;

  return (
    <>
      <Menu>
        <MenuTrigger
          render={<Button variant="ghost" size="icon-xs" />}
          aria-label={t("navigation:chat.actions")}
        >
          <MoreHorizontal />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-48">
          {!isGuest && (
            <>
              <MenuItem onClick={() => setDialog("topic")}>
                {t("navigation:chat.setTopic")}
              </MenuItem>
              {!archived && (
                <MenuItem onClick={() => setDialog("members")}>
                  {t("navigation:chat.addMember")}
                </MenuItem>
              )}
              {canManageMembers && (
                <MenuItem onClick={() => setDialog("manage")}>
                  {t("navigation:chat.manageMembers")}
                </MenuItem>
              )}
              <MenuItem
                onClick={() =>
                  update.mutate({ archived: !archived }, { onError })
                }
              >
                {archived
                  ? t("navigation:chat.unarchive")
                  : t("navigation:chat.archive")}
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem
            onClick={() =>
              leave.mutate(undefined, {
                onError,
                onSuccess: () =>
                  navigate({
                    to: "/dashboard/workspace/$workspaceId/channels",
                    params: { workspaceId },
                  }),
              })
            }
          >
            {t("navigation:chat.leave")}
          </MenuItem>
        </MenuPopup>
      </Menu>
      {dialog === "topic" && (
        <ChannelTopicDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          workspaceId={workspaceId}
          channel={channel}
        />
      )}
      {dialog === "manage" && (
        <ChannelMembersDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          workspaceId={workspaceId}
          channel={channel}
        />
      )}
      {dialog === "members" && (
        <AddMemberDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          workspaceId={workspaceId}
          channel={channel}
        />
      )}
    </>
  );
}
