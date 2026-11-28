import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";
import { HttpError } from "@/lib/http-error";
import { fromBase64, toBase64 } from "./base64";

/** Marks changes that came from the server, so they are not sent back. */
export const REMOTE = Symbol("remote");

export type CollabTransport = {
  /** `content` is the text to seed from when there is no `state`. */
  load(): Promise<{
    state: string | null;
    contentHash: string;
    content: string | null;
  }>;
  seed(update: string, baseHash: string): Promise<unknown>;
  send(update: string): Promise<unknown>;
  sendAwareness(update: string): Promise<unknown>;
};

/** "stale": someone started over from another text; open a new session. */
export type CollabStatus = "loading" | "ready" | "failed" | "stale";

const SEND_DELAY_MS = 50;
const RETRY_MS = 1_000;

const hasCode = (error: unknown, code: string) =>
  error instanceof HttpError && error.code === code;

/**
 * One person's live copy of a co-edited document: a Yjs doc and the cursors
 * of the others, kept in step with the server through `transport`.
 */
export class CollabSession {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  status: CollabStatus = "loading";
  private pending: Uint8Array[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private awarenessTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private destroyed = false;

  constructor(
    private transport: CollabTransport,
    private seedFrom: (doc: Y.Doc, markdown: string) => void,
  ) {}

  async start() {
    try {
      await this.join();
      if (this.destroyed) return;
      this.doc.on("update", this.onLocalUpdate);
      this.awareness.on("update", this.onAwareness);
      this.setStatus("ready");
    } catch {
      this.setStatus("failed");
    }
  }

  // Loads the state, or seeds it from the text. Two people who open an
  // unseeded document together race; the loser loads the winner's state.
  private async join() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { state, contentHash, content } = await this.transport.load();
      if (state) {
        Y.applyUpdate(this.doc, fromBase64(state), REMOTE);
        return;
      }
      const seeded = new Y.Doc();
      this.seedFrom(seeded, content ?? "");
      const update = Y.encodeStateAsUpdate(seeded);
      try {
        await this.transport.seed(toBase64(update), contentHash);
        Y.applyUpdate(this.doc, update, REMOTE);
        return;
      } catch (error) {
        if (
          !hasCode(error, "COEDIT_SEEDED") &&
          !hasCode(error, "DOCUMENT_CHANGED")
        )
          throw error;
      }
    }
    throw new Error("Could not join co-editing");
  }

  receive(update: string) {
    Y.applyUpdate(this.doc, fromBase64(update), REMOTE);
  }

  receiveAwareness(update: string) {
    applyAwarenessUpdate(this.awareness, fromBase64(update), REMOTE);
  }

  markStale() {
    this.setStatus("stale");
  }

  /** After the socket was down: takes in whatever was missed meanwhile. */
  async resync() {
    if (this.status !== "ready") return;
    try {
      const { state } = await this.transport.load();
      if (state) Y.applyUpdate(this.doc, fromBase64(state), REMOTE);
      else this.markStale();
    } catch {
      // The next reconnect tries again.
    }
  }

  private onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || this.status !== "ready") return;
    this.pending.push(update);
    this.schedule(SEND_DELAY_MS);
  };

  private schedule(delay: number) {
    if (this.timer || this.destroyed) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }

  /** Sends what was typed since the last send, as one update. */
  async flush() {
    if (!this.pending.length) return;
    const update = Y.mergeUpdates(this.pending.splice(0));
    try {
      await this.transport.send(toBase64(update));
    } catch (error) {
      if (hasCode(error, "COEDIT_NOT_SEEDED")) return this.markStale();
      // Refused for good (too large, access gone): resending cannot help.
      if (error instanceof HttpError && error.status < 500) {
        this.pending = [];
        return this.setStatus("failed");
      }
      // Kept, and sent with the next change or on the retry.
      this.pending.unshift(update);
      this.schedule(RETRY_MS);
    }
  }

  private onAwareness = (
    change: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === REMOTE) return;
    const own = [...change.added, ...change.updated, ...change.removed];
    if (!own.includes(this.doc.clientID)) return;
    if (this.awarenessTimer) return;
    this.awarenessTimer = setTimeout(() => {
      this.awarenessTimer = undefined;
      this.sendAwareness();
    }, SEND_DELAY_MS);
  };

  private sendAwareness() {
    const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
    // A lost cursor update is replaced by the next one.
    void this.transport.sendAwareness(toBase64(update)).catch(() => {});
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setStatus(status: CollabStatus) {
    if (this.destroyed) return;
    this.status = status;
    for (const listener of this.listeners) listener();
  }

  destroy() {
    if (this.destroyed) return;
    clearTimeout(this.timer);
    clearTimeout(this.awarenessTimer);
    void this.flush();
    if (this.status === "ready") {
      // Others drop this person's cursor.
      removeAwarenessStates(this.awareness, [this.doc.clientID], "local");
      this.sendAwareness();
    }
    this.destroyed = true;
    this.doc.off("update", this.onLocalUpdate);
    this.awareness.off("update", this.onAwareness);
    this.awareness.destroy();
    this.listeners.clear();
  }
}
