import { router } from "expo-router";
import { Hash, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import { Txt } from "@/components/text";
import { CountBadge, Touch } from "@/components/ui";
import type { ChatChannel } from "@/lib/api/types";
import { inset, useColors } from "@/theme";

export function ChannelRow({
  channel,
  title,
  first,
}: {
  channel: ChatChannel;
  title: string;
  first: boolean;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const unread = channel.unreadCount > 0;
  return (
    <Touch
      onPress={() =>
        router.push({
          pathname: "/chat/[channelId]",
          params: { channelId: channel.id, workspaceId: channel.workspaceId },
        })
      }
      accessibilityLabel={
        unread
          ? `${title}, ${t("mobile:chat.unread", { count: channel.unreadCount })}`
          : title
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: inset,
        minHeight: 52,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.divider,
      }}
    >
      {channel.isDirect ? (
        <Avatar name={title} size={24} />
      ) : (
        <View style={{ width: 24, alignItems: "center" }}>
          {channel.isPrivate ? (
            <Lock size={16} color={c.muted} strokeWidth={2} />
          ) : (
            <Hash size={16} color={c.muted} strokeWidth={2} />
          )}
        </View>
      )}
      <Txt
        variant="body"
        weight={unread ? "semibold" : "regular"}
        tone={channel.isMember || channel.isDirect ? "ink" : "muted"}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {channel.isDirect ? title : title.replace(/^#/, "")}
      </Txt>
      {unread ? <CountBadge count={channel.unreadCount} tone="info" /> : null}
    </Touch>
  );
}
