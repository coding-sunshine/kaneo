import * as Y from "yjs";
import { HttpError } from "@/lib/http-error";
import { fromBase64, toBase64 } from "./base64";
import { collabRegistry } from "./collab-registry";
import type { CollabTransport } from "./collab-session";

/**
 * Stands in for the API's co-editing routes in tests: one stored state, the
 * seed race, and delivery of every change to the open sessions.
 */
export function createFakeCollabServer(documentId: string, content: string) {
  let state: Uint8Array | null = null;
  // Deliveries lost on the way, as on a socket that dropped.
  let dropping = 0;
  const contentHash = "h-1";
  const refused = (code: string) => new HttpError(409, code, { code });
  const deliver = (type: string, update: Uint8Array) => {
    if (dropping > 0) {
      dropping -= 1;
      return;
    }
    collabRegistry.deliver({ type, documentId, update: toBase64(update) });
  };
  const transport: CollabTransport = {
    async load() {
      return state
        ? { state: toBase64(state), contentHash, content: null }
        : { state: null, contentHash, content };
    },
    async seed(update, baseHash) {
      if (baseHash !== contentHash) throw refused("DOCUMENT_CHANGED");
      if (state) throw refused("COEDIT_SEEDED");
      state = fromBase64(update);
      return { applied: true };
    },
    async send(update) {
      if (!state) throw refused("COEDIT_NOT_SEEDED");
      const bytes = fromBase64(update);
      state = Y.mergeUpdates([state, bytes]);
      deliver("DOCUMENT_COLLAB_UPDATE", bytes);
      return { applied: true };
    },
    async sendAwareness(update) {
      deliver("DOCUMENT_COLLAB_AWARENESS", fromBase64(update));
      return { applied: true };
    },
  };
  return {
    transport,
    seeds: () => (state ? 1 : 0),
    dropNext: () => {
      dropping += 1;
    },
  };
}
