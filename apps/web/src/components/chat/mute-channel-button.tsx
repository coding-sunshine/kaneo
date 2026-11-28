import { Bell, BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatChannelDetail } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import { useMuteChannel } from "@/hooks/mutations/chat/use-channel-mutations";
import { toast } from "@/lib/toast";

/**
 * Mutes the channel for you: its mentions and direct messages stop reaching
 * your Inbox. Anyone who can read the channel may mute it.
 */
export function MuteChannelButton({
  workspaceId,
  channel,
}: {
  workspaceId: string;
  channel: ChatChannelDetail;
}) {
  const { t } = useTranslation();
  const mute = useMuteChannel(workspaceId, channel.id);
  const label = channel.isMuted
    ? t("navigation:chat.unmute")
    : t("navigation:chat.mute");

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={channel.isMuted}
      title={label}
      disabled={mute.isPending}
      onClick={() =>
        mute.mutate(!channel.isMuted, {
          onSuccess: ({ muted }) =>
            toast.success(
              muted
                ? t("navigation:chat.mutedNotice")
                : t("navigation:chat.unmutedNotice"),
            ),
          onError: (error) => toast.error(error.message),
        })
      }
    >
      {channel.isMuted ? <BellOff /> : <Bell />}
    </Button>
  );
}
