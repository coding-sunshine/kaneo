import { useCallback, useEffect, useRef } from "react";
import { sendTyping } from "@/fetchers/chat/typing";

const KEEP_ALIVE_MS = 3000;
const IDLE_MS = 5000;

/**
 * Tells the channel's open readers that I am typing: on the first key, again
 * every few seconds while I keep typing, and that I stopped once I go quiet,
 * clear the text, send, or leave the channel. A lost signal only means a
 * stale indicator for a few seconds, so failures are dropped.
 */
export function useTypingSignal(workspaceId: string, channelId: string) {
  const typing = useRef(false);
  const lastSent = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signal = useCallback(
    (on: boolean) =>
      void sendTyping(workspaceId, channelId, on).catch(() => {}),
    [workspaceId, channelId],
  );

  const stop = useCallback(() => {
    if (idle.current !== null) clearTimeout(idle.current);
    idle.current = null;
    if (!typing.current) return;
    typing.current = false;
    signal(false);
  }, [signal]);

  const typed = useCallback(
    (text: string) => {
      if (!text.trim()) return stop();
      if (idle.current !== null) clearTimeout(idle.current);
      idle.current = setTimeout(stop, IDLE_MS);
      const now = Date.now();
      if (typing.current && now - lastSent.current < KEEP_ALIVE_MS) return;
      typing.current = true;
      lastSent.current = now;
      signal(true);
    },
    [signal, stop],
  );

  useEffect(() => stop, [stop]);

  return { typed, stop };
}
