import { useCallback, useRef } from "react";
import { announceDocumentEditing } from "@/fetchers/document/editing";

// Under the time other readers keep the name up (`EDITING_SHOWN_MS`).
const EVERY_MS = 5_000;

/** Returns a call to make on each keystroke; it reaches the API now and then. */
export function useEditingAnnouncer(workspaceId: string, id: string) {
  const last = useRef(Number.NEGATIVE_INFINITY);
  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < EVERY_MS) return;
    last.current = now;
    // A missed hint only hides a name for a moment.
    void announceDocumentEditing(workspaceId, id).catch(() => {});
  }, [workspaceId, id]);
}
