import i18n from "i18next";
import { toast } from "@/lib/toast";
import type { CallTarget } from "@/store/call";

type Ring = CallTarget & { callerName: string; isDirect: boolean };

// A ring that nobody answers stops after this long.
const RING_MS = 30_000;

/** Shows an incoming call with a button that answers it. */
export function ringIncomingCall(
  ring: Ring,
  answer: (call: CallTarget) => void,
) {
  const { callerName, isDirect, workspaceId, channelId } = ring;
  // A direct message has no name of its own; the caller names it.
  const call = {
    workspaceId,
    channelId,
    channelName: isDirect ? callerName : ring.channelName,
  };
  toast.info(i18n.t("navigation:chat.incomingCall", { name: callerName }), {
    description: isDirect
      ? undefined
      : i18n.t("navigation:chat.incomingCallIn", {
          channel: ring.channelName,
        }),
    timeout: RING_MS,
    action: {
      label: i18n.t("navigation:chat.answerCall"),
      onClick: () => answer(call),
    },
  });
}
