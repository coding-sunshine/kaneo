import type { ChatDraft } from "@/hooks/queries/chat/use-drafts";

/** The draft list with one channel's draft replaced; empty text removes it. */
export function withDraft(
  drafts: ChatDraft[] | undefined,
  channelId: string,
  body: string,
): ChatDraft[] {
  const rest = (drafts ?? []).filter((draft) => draft.channelId !== channelId);
  if (!body.trim()) return rest;
  return [{ channelId, body, updatedAt: new Date().toISOString() }, ...rest];
}
