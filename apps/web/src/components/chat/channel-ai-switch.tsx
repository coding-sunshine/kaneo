import { Bot, BotOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatChannelDetail } from "@/components/chat/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUpdateChannel } from "@/hooks/mutations/chat/use-channel-mutations";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import useGetMyProjectAccess from "@/hooks/queries/workspace-users/use-get-my-project-access";
import { toast } from "@/lib/toast";

/**
 * Whether AI may read this channel or direct message, in its header. Members
 * who are not guests switch it; everyone else only sees that it is off.
 */
export function ChannelAiSwitch({
  workspaceId,
  channel,
}: {
  workspaceId: string;
  channel: ChatChannelDetail;
}) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const isGuest = useGetMyProjectAccess(workspaceId).data?.guest ?? false;
  const update = useUpdateChannel(workspaceId, channel.id);
  const off = channel.aiDisabled;
  const badge = t("navigation:chat.aiOffBadge");

  if (!hasAgent || !channel.isMember || isGuest)
    return off ? (
      <Badge variant="outline">
        <BotOff aria-hidden />
        {badge}
      </Badge>
    ) : null;

  const label = channel.isDirect
    ? off
      ? t("navigation:chat.aiOnDirect")
      : t("navigation:chat.aiOffDirect")
    : off
      ? t("navigation:chat.aiOn")
      : t("navigation:chat.aiOff");

  return (
    <Button
      variant={off ? "outline" : "ghost"}
      size={off ? "xs" : "icon-xs"}
      aria-label={label}
      aria-pressed={off}
      title={label}
      disabled={update.isPending}
      onClick={() =>
        update.mutate(
          { aiDisabled: !off },
          { onError: (error) => toast.error(error.message) },
        )
      }
    >
      {off ? <BotOff /> : <Bot />}
      {off && badge}
    </Button>
  );
}
