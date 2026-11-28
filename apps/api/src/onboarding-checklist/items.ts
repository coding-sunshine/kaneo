// The checklist in display order. "set-status" is ticked by setting a status;
// the rest are ticked when the person follows their link.
export const CHECKLIST_ITEMS = [
  "set-status",
  "read-handbook",
  "say-hello",
  "open-sample-ticket",
  "invite-teammate",
] as const;

export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];

export const MANUAL_CHECKLIST_ITEMS = [
  "read-handbook",
  "say-hello",
  "open-sample-ticket",
  "invite-teammate",
] as const satisfies readonly ChecklistItem[];
