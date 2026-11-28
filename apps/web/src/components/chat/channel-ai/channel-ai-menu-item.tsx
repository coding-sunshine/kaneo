import { useTranslation } from "react-i18next";
import { MenuItem } from "@/components/ui/menu";
import {
  useChannelAi,
  useSetChannelAi,
} from "@/hooks/queries/catch-up/use-channel-ai";

/** Marks the channel "no AI" so catch-ups, answers and briefs skip it, or lifts the mark. */
export function ChannelAiMenuItem({
  workspaceId,
  channelId,
}: {
  workspaceId: string;
  channelId: string;
}) {
  const { t } = useTranslation();
  const { data } = useChannelAi(workspaceId, channelId);
  const set = useSetChannelAi(workspaceId, channelId);
  if (!data) return null;
  return (
    <MenuItem
      disabled={set.isPending}
      onClick={() => set.mutate(!data.excluded)}
    >
      {data.excluded
        ? t("navigation:chat.ai.allow")
        : t("navigation:chat.ai.exclude")}
    </MenuItem>
  );
}
