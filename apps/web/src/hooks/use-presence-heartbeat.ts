import { useEffect } from "react";
import { sendPresenceHeartbeat } from "@/fetchers/chat/presence";

const HEARTBEAT_MS = 30_000;

/** Keeps you online while chat is open; only runs while presence is on. */
export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const beat = () => void sendPresenceHeartbeat().catch(() => {});
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [enabled]);
}
