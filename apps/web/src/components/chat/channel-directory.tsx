import { useTranslation } from "react-i18next";
import { ChannelDirectoryRow } from "@/components/chat/channel-directory-row";
import type { ChatChannel } from "@/components/chat/types";

/** Every channel you can see: public ones to join, and your private ones. */
export function ChannelDirectory({
  workspaceId,
  channels,
}: {
  workspaceId: string;
  channels: ChatChannel[];
}) {
  const { t } = useTranslation();

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-16 text-center">
        <p className="text-sm font-medium">{t("navigation:chat.empty")}</p>
        <p className="text-sm text-muted-foreground">
          {t("navigation:chat.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {channels.map((channel) => (
        <ChannelDirectoryRow
          key={channel.id}
          workspaceId={workspaceId}
          channel={channel}
        />
      ))}
    </ul>
  );
}
