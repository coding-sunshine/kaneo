import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { EmptyState, ErrorState, Loading, Scroll } from "@/components/screen";
import { Txt } from "@/components/text";
import { userMessage } from "@/lib/api/client";
import { useMembers } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { inset, useColors } from "@/theme";

import { ChannelRow } from "./channel-row";
import { channelTitle } from "./channel-title";
import { useChatLists } from "./use-chat-lists";

export function ChatTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const session = useSession();
  const members = useMembers(workspaceId);
  const { channels, direct } = useChatLists(workspaceId);
  const people = (members.data ?? []).map((m) => ({
    userId: m.id,
    name: m.name,
  }));
  const title = (channel: Parameters<typeof channelTitle>[0]) =>
    channelTitle(channel, session?.userId, people, t("mobile:chat.you"));
  // Joined channels first; public ones you have not joined stay listed, dimmed.
  const channelList = [...(channels.data ?? [])]
    .filter((ch) => !ch.isDirect && !ch.archivedAt)
    .sort(
      (a, b) =>
        Number(b.isMember) - Number(a.isMember) || a.name.localeCompare(b.name),
    );
  const directList = direct.data ?? [];
  const refetch = () => {
    void channels.refetch();
    void direct.refetch();
  };
  const heading = (label: string) => (
    <Txt
      variant="caption"
      weight="medium"
      tone="muted"
      style={{ paddingHorizontal: inset, paddingTop: 16, paddingBottom: 6 }}
    >
      {label}
    </Txt>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{ height: 52, justifyContent: "center", paddingLeft: inset }}
      >
        <Txt variant="title">{t("mobile:chat.title")}</Txt>
      </View>
      {channels.isLoading ? (
        <Loading />
      ) : channels.error ? (
        <ErrorState message={userMessage(channels.error)} onRetry={refetch} />
      ) : channelList.length + directList.length === 0 ? (
        <EmptyState
          title={t("mobile:chat.empty.title")}
          message={t("mobile:chat.empty.message")}
        />
      ) : (
        <Scroll
          refreshing={channels.isRefetching || direct.isRefetching}
          onRefresh={refetch}
        >
          {channelList.length ? heading(t("mobile:chat.channels")) : null}
          {channelList.map((ch, i) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              title={title(ch)}
              first={i === 0}
            />
          ))}
          {directList.length ? heading(t("mobile:chat.directMessages")) : null}
          {directList.map((ch, i) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              title={title(ch)}
              first={i === 0}
            />
          ))}
        </Scroll>
      )}
    </View>
  );
}
