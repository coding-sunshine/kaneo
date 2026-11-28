import type { CollabSession } from "./collab-session";

const sessions = new Map<string, Set<CollabSession>>();

/** The open co-editing sessions, so live messages reach them by document. */
export const collabRegistry = {
  add(documentId: string, session: CollabSession) {
    const open = sessions.get(documentId) ?? new Set();
    sessions.set(documentId, open.add(session));
    return () => {
      open.delete(session);
      if (!open.size) sessions.delete(documentId);
    };
  },
  /** The socket reconnected: messages may have been lost meanwhile. */
  resync() {
    return Promise.all(
      [...sessions.values()].flatMap((open) =>
        [...open].map((session) => session.resync()),
      ),
    );
  },
  deliver(message: { type?: string; documentId?: string; update?: unknown }) {
    if (!message.documentId) return;
    for (const session of sessions.get(message.documentId) ?? []) {
      if (message.type === "DOCUMENT_COLLAB_RESET") session.markStale();
      if (typeof message.update !== "string") continue;
      if (message.type === "DOCUMENT_COLLAB_UPDATE")
        session.receive(message.update);
      if (message.type === "DOCUMENT_COLLAB_AWARENESS")
        session.receiveAwareness(message.update);
    }
  },
};
