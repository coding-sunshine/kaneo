/** How long a name stays up after its last live hint. */
export const EDITING_SHOWN_MS = 8_000;

export type DocumentEditorHint = {
  userId: string;
  name: string;
  until: number;
};

const byDocument = new Map<string, DocumentEditorHint[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Who else is typing in each document, as live hints report it. */
export const documentEditors = {
  note(documentId: string, userId: string, name: string, now = Date.now()) {
    const others = (byDocument.get(documentId) ?? []).filter(
      (hint) => hint.userId !== userId && hint.until > now,
    );
    byDocument.set(documentId, [
      ...others,
      { userId, name, until: now + EDITING_SHOWN_MS },
    ]);
    notify();
  },
  current(documentId: string, now = Date.now()) {
    return (byDocument.get(documentId) ?? []).filter(
      (hint) => hint.until > now,
    );
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  clear() {
    byDocument.clear();
    notify();
  },
};
