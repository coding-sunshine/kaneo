import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import { channelKey } from "@/hooks/queries/chat/use-channel";
import { messagesKey } from "@/hooks/queries/chat/use-messages";
import { pinsKey } from "@/hooks/queries/chat/use-pins";

export function getChatWsUrl(channelId: string) {
  const wsBase = getApiUrl("ws").replace(/^http/, "ws");
  return `${wsBase}/chat/${encodeURIComponent(channelId)}`;
}

const BASE_DELAY = 1000;
const MAX_RETRY_DELAY = 30_000;
const WS_PING_INTERVAL_MS = 30_000;

/**
 * Watches one channel and refetches its messages when one is posted, edited,
 * pinned or deleted.
 * Returns whether the socket is open, so callers poll only while it is not.
 */
export function useChatChannelSocket(
  workspaceId: string,
  channelId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryDelay = BASE_DELAY;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const refetchMessages = () =>
      void queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId, channelId),
      });

    function drop() {
      if (pingInterval !== null) clearInterval(pingInterval);
      if (retryTimeout !== null) clearTimeout(retryTimeout);
      pingInterval = null;
      retryTimeout = null;
      const current = socket;
      socket = null;
      current?.close();
      setLive(false);
    }

    function connect() {
      if (disposed) return;
      const ws = new WebSocket(getChatWsUrl(channelId));
      socket = ws;

      ws.onopen = () => {
        if (socket !== ws) return;
        retryDelay = BASE_DELAY;
        setLive(true);
        // Anything posted while this socket was down arrives with this fetch.
        refetchMessages();
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "ping" }));
        }, WS_PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (socket !== ws) return;
        try {
          const message = JSON.parse(event.data as string) as {
            type?: string;
            channelId?: string;
          };
          if (message.channelId !== channelId) return;
          if (message.type === "CHAT_MESSAGE_CREATED") refetchMessages();
          if (message.type === "CHAT_MESSAGE_CHANGED") {
            refetchMessages();
            void queryClient.invalidateQueries({
              queryKey: pinsKey(workspaceId, channelId),
            });
          }
        } catch {
          // Ignore malformed messages.
        }
      };

      ws.onclose = (event) => {
        if (socket !== ws) return;
        drop();
        // 1008: the channel is no longer readable; let its query say why.
        if (event?.code === 1008) {
          void queryClient.invalidateQueries({
            queryKey: channelKey(workspaceId, channelId),
          });
          return;
        }
        const delay = retryDelay;
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
        retryTimeout = setTimeout(connect, delay);
      };
    }

    // A socket can look open after the network drops, so do not wait for it
    // to time out: reconnect as soon as the browser is back online.
    function reconnectNow() {
      if (disposed) return;
      drop();
      retryDelay = BASE_DELAY;
      connect();
    }

    connect();
    window.addEventListener("online", reconnectNow);

    return () => {
      disposed = true;
      window.removeEventListener("online", reconnectNow);
      drop();
    };
  }, [enabled, workspaceId, channelId, queryClient]);

  return live;
}
