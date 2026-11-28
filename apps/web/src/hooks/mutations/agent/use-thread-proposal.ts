import { useMutation } from "@tanstack/react-query";
import {
  proposeFromThread,
  type ThreadProposalKind,
} from "@/fetchers/agent/thread-proposal";

/** Drafts a ticket or decision card from a chat thread; nothing is saved yet. */
export function useThreadProposal(
  workspaceId: string,
  channelId: string,
  kind: ThreadProposalKind,
) {
  return useMutation({
    mutationFn: (messageId: string) =>
      proposeFromThread(kind, workspaceId, channelId, messageId),
  });
}
