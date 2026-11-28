import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";

import { ErrorState, Loading, Screen, TopBar } from "@/components/screen";
import { useToast } from "@/components/toast";
import { Txt } from "@/components/text";
import { Button } from "@/components/ui";
import { ChatComposer } from "@/features/chat/chat-composer";
import { ChatHint } from "@/features/chat/chat-hint";
import { channelTitle } from "@/features/chat/channel-title";
import { groupMessages } from "@/features/chat/message-groups";
import { MessageRow } from "@/features/chat/message-row";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { useMembers } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { useRealtime } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { useWorkspaceCapabilities } from "@/lib/use-workspace-capabilities";
import { inset, useColors } from "@/theme";

export default function ChatChannelScreen() {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const client = useQueryClient();
  const toast = useToast();
  const session = useSession();
  const { run, busy } = useAction();
  const { channelId, workspaceId } = useLocalSearchParams<{
    channelId: string;
    workspaceId: string;
  }>();
  const channel = useQuery({
    queryKey: qk.chatChannel(channelId),
    queryFn: () => api.chatChannel(workspaceId, channelId),
  });
  const messages = useQuery({
    queryKey: qk.chatMessages(channelId),
    queryFn: () => api.chatMessages(workspaceId, channelId),
  });
  const members = useMembers(workspaceId);
  const capabilities = useWorkspaceCapabilities(workspaceId);

  const markRead = useCallback(() => {
    api.markChatRead(workspaceId, channelId).then(
      () =>
        client.invalidateQueries({ queryKey: qk.chatChannels(workspaceId) }),
      () => {},
    );
  }, [client, workspaceId, channelId]);

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: qk.chatMessages(channelId) });
    markRead();
  }, [client, channelId, markRead]);

  // The socket only says the channel changed; the history is fetched again.
  useRealtime(`api/ws/chat/${channelId}`, (event) => {
    if (
      event.type === "CHAT_MESSAGE_CREATED" ||
      event.type === "CHAT_MESSAGE_UPDATED"
    )
      refresh();
  });
  // Messages sent while the app was in the background never reached the socket.
  useEffect(() => {
    markRead();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [markRead, refresh]);

  const detail = channel.data;
  const people = (members.data ?? []).map((m) => ({
    userId: m.id,
    name: m.name,
  }));
  const title = detail
    ? channelTitle(detail, session?.userId, people, t("mobile:chat.you"))
    : "";
  // Posting changes workspace content: read-only roles can read, not post.
  const canWrite = capabilities.data?.updateTasks !== false;
  const rows = groupMessages(messages.data ?? []).reverse();

  const send = async (body: string) => {
    try {
      await api.postChatMessage(workspaceId, channelId, body);
      refresh();
      return true;
    } catch (e) {
      toast.show(userMessage(e), "error");
      return false;
    }
  };

  const footer = !detail ? null : detail.archivedAt ? (
    <ChatHint text={t("mobile:chat.archived")} />
  ) : !canWrite ? (
    <ChatHint text={t("mobile:chat.readOnly")} />
  ) : !detail.isMember && !detail.isDirect ? (
    <View
      style={{
        padding: inset,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: c.hairline,
      }}
    >
      <Txt variant="meta" tone="muted" center>
        {t("mobile:chat.joinHint")}
      </Txt>
      <Button
        label={t("mobile:chat.join")}
        loading={busy}
        onPress={() => run(() => api.joinChatChannel(workspaceId, channelId))}
      />
    </View>
  ) : (
    <ChatComposer
      placeholder={t("mobile:chat.placeholder", { name: title })}
      onSend={send}
    />
  );

  return (
    <Screen surface>
      <TopBar>
        <Txt variant="section" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Txt>
      </TopBar>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {channel.isLoading || messages.isLoading ? (
          <Loading />
        ) : channel.error || messages.error ? (
          <ErrorState
            message={userMessage(channel.error ?? messages.error)}
            onRetry={() => {
              void channel.refetch();
              void messages.refetch();
            }}
          />
        ) : rows.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Txt variant="bodySm" tone="muted" center>
              {t("mobile:chat.noMessages")}
            </Txt>
          </View>
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => row.message.id}
            renderItem={({ item }) => (
              <MessageRow message={item.message} showAuthor={item.showAuthor} />
            )}
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          />
        )}
        {footer}
      </KeyboardAvoidingView>
    </Screen>
  );
}
