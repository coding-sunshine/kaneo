import { useMutation } from "@tanstack/react-query";
import {
  rewriteSelection,
  type WritingAction,
} from "@/fetchers/agent/writing-help";

/** Asks for a rewrite of a selection; the result is only shown, not saved. */
export function useWritingHelp(workspaceId: string) {
  return useMutation({
    mutationFn: (input: { action: WritingAction; text: string }) =>
      rewriteSelection(workspaceId, input.action, input.text),
  });
}
