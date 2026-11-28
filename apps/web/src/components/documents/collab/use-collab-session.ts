import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getCollabState,
  seedCollabState,
  sendCollabAwareness,
  sendCollabUpdate,
} from "@/fetchers/document/collab";
import { collabRegistry } from "@/lib/document-collab/collab-registry";
import {
  CollabSession,
  type CollabTransport,
} from "@/lib/document-collab/collab-session";
import { seedFromMarkdown } from "./seed-from-markdown";

const transportFor = (workspaceId: string, id: string): CollabTransport => ({
  load: () => getCollabState(workspaceId, id),
  seed: (update, baseHash) =>
    seedCollabState(workspaceId, id, { update, baseHash }),
  send: (update) => sendCollabUpdate(workspaceId, id, update),
  sendAwareness: (update) => sendCollabAwareness(workspaceId, id, update),
});

const idle = () => () => {};

/**
 * A live co-editing session for the document, started over whenever someone
 * reseeds it or `generation` changes.
 */
export function useCollabSession(
  workspaceId: string,
  documentId: string,
  generation: number,
) {
  const [restarts, setRestarts] = useState(0);
  const [session, setSession] = useState<CollabSession | null>(null);
  useEffect(() => {
    void restarts;
    void generation;
    const next = new CollabSession(
      transportFor(workspaceId, documentId),
      seedFromMarkdown,
    );
    const remove = collabRegistry.add(documentId, next);
    const unsubscribe = next.subscribe(() => {
      if (next.status === "stale") setRestarts((count) => count + 1);
    });
    setSession(next);
    void next.start();
    return () => {
      unsubscribe();
      remove();
      next.destroy();
    };
  }, [workspaceId, documentId, generation, restarts]);
  const status = useSyncExternalStore(
    session?.subscribe ?? idle,
    () => session?.status ?? "loading",
  );
  return { session, status };
}
