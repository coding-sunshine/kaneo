import { publishEvent } from "../events";

export type ReaderHint = {
  workspaceId: string;
  documentId: string;
  /** Left out of the delivery: the person the hint is about. */
  exceptUserId?: string;
  message: { type: string; [key: string]: unknown };
};

/**
 * Sends a live message to everyone who can open the document, over their user
 * socket. The access check runs at delivery (`ws/index.ts`).
 */
export function tellReaders(hint: ReaderHint) {
  return publishEvent("document.reader_hint", hint);
}
