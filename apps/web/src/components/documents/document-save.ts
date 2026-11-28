import { descriptionSaveQueue } from "@/lib/description-save-queue";

/**
 * Document saves share one owner across mounts, so reopening a document picks
 * up an edit that is still on its way and a restore can drain it first.
 */
export const DOCUMENT_SAVE_OWNER = "document-page";

export const documentSaveKey = (field: "title" | "content", id: string) =>
  field === "title" ? `document-title:${id}` : `document:${id}`;

/** The newest value for a field: an unsaved edit wins over the server copy. */
export function latestDocumentValue(key: string, saved: string) {
  const pending = descriptionSaveQueue.get(key, DOCUMENT_SAVE_OWNER);
  return pending && pending.state !== "saved" ? pending.value : saved;
}

const bases = new Map<string, string>();

/**
 * The `contentHash` each document's text was last loaded or saved at. It
 * outlives a remount, as the unsaved edit it belongs to does.
 */
export const documentBases = {
  get: (id: string) => bases.get(id),
  set: (id: string, hash: string) => void bases.set(id, hash),
  /** On open: keep the base of a pending edit, else take the loaded one. */
  adopt(id: string, loaded: string) {
    const pending = descriptionSaveQueue.get(
      documentSaveKey("content", id),
      DOCUMENT_SAVE_OWNER,
    );
    if (!pending || pending.state === "saved" || !bases.has(id))
      bases.set(id, loaded);
  },
};
