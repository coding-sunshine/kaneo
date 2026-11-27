import { joinCall } from "@/fetchers/chat/calls";
import { toast } from "@/lib/toast";
import { type CallTarget, useCallStore } from "@/store/call";

export async function answerCall(target: CallTarget) {
  try {
    const session = await joinCall(target);
    useCallStore.getState().setSession({ ...target, ...session });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}
