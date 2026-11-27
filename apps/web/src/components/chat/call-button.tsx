import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useStartCall } from "@/hooks/mutations/chat/use-start-call";
import { useHasCalls } from "@/hooks/queries/call/use-has-calls";
import { toast } from "@/lib/toast";

/** Starts a call in the channel; absent until the server has calls set up. */
export function CallButton({
  workspaceId,
  channel,
}: {
  workspaceId: string;
  channel: {
    id: string;
    name: string;
    isMember: boolean;
    archivedAt: string | Date | null;
  };
}) {
  const { t } = useTranslation();
  const hasCalls = useHasCalls();
  const start = useStartCall();
  if (!hasCalls || !channel.isMember || channel.archivedAt) return null;
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={t("navigation:chat.startCall")}
      title={t("navigation:chat.startCall")}
      disabled={start.isPending}
      onClick={() =>
        start.mutate(
          { workspaceId, channelId: channel.id, channelName: channel.name },
          { onError: (error) => toast.error(error.message) },
        )
      }
    >
      <Phone />
    </Button>
  );
}
