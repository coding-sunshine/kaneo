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
