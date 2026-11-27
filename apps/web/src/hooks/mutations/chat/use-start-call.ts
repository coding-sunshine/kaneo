import { useMutation } from "@tanstack/react-query";
import { startCall } from "@/fetchers/chat/calls";
import { type CallTarget, useCallStore } from "@/store/call";

/** Starts a call, which rings the other channel members, and joins it. */
export function useStartCall() {
  const setSession = useCallStore((state) => state.setSession);
  return useMutation({
    mutationFn: async (target: CallTarget) => ({
      ...target,
      ...(await startCall(target)),
    }),
    onSuccess: setSession,
  });
}
