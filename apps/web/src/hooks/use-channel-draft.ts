import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft } from "@/fetchers/chat/drafts";
import { draftsKey, useDrafts } from "@/hooks/queries/chat/use-drafts";
import { withDraft } from "@/hooks/with-draft";

const SAVE_DELAY_MS = 600;

type Pending = { channelId: string; body: string; timer: number };

/**
 * The composer text of one channel, kept as the caller's draft. Typing updates
 * the cached draft list at once and saves after a pause; leaving the channel,
 * unmounting or closing the page saves right away.
 */
export function useChannelDraft(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  const { data: drafts } = useDrafts(workspaceId);
  const [typed, setTyped] = useState<{ channelId: string; body: string }>();
  const pending = useRef<Pending | null>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  const saved =
    drafts?.find((draft) => draft.channelId === channelId)?.body ?? "";
  // Once typed into, the text wins over a later refetch of the list.
  const body = typed?.channelId === channelId ? typed.body : saved;

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next) return;
    window.clearTimeout(next.timer);
    pending.current = null;
    saving.current = saveDraft(
      { workspaceId, channelId: next.channelId },
      next.body,
    ).catch(() => undefined);
  }, [workspaceId]);

  // Cleanup runs on channel change and unmount: save what was typed.
  useEffect(() => flush, [flush, channelId]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [flush]);

  const setDraft = (next: string, persist = true) => {
    setTyped({ channelId, body: next });
    queryClient.setQueryData<typeof drafts>(draftsKey(workspaceId), (old) =>
      withDraft(old, channelId, next),
    );
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = persist
      ? {
          channelId,
          body: next,
          timer: window.setTimeout(flush, SAVE_DELAY_MS),
        }
      : null;
  };

  return {
    body,
    setBody: (next: string) => setDraft(next),
    /**
     * Drops the unsaved edit before sending and waits for a save already on
     * its way, so it cannot land after the message and bring the draft back.
     * Posting deletes the draft on the server.
     */
    beforeSend: () => {
      if (pending.current) window.clearTimeout(pending.current.timer);
      pending.current = null;
      return saving.current;
    },
    clear: () => setDraft("", false),
  };
}
