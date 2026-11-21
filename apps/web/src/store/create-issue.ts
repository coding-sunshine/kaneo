import { create } from "zustand";

/** What "New issue from comment" hands to the create modal. */
export type CreateIssueDraft = {
  projectId: string;
  description: string;
  workProjectId?: string | null;
  workProjectMilestoneId?: string | null;
  /** The issue the comment is on; "parent" makes it the new issue's parent. */
  link?: { taskId: string; type: "related" | "parent" };
  /** The comment the issue is made from; it then lists the issue. */
  sourceCommentId?: string;
};

// Lets any "New issue" button open the global create modal owned by the command palette.
export const useCreateIssueStore = create<{
  open: boolean;
  draft: CreateIssueDraft | null;
  setOpen: (open: boolean) => void;
  openWithDraft: (draft: CreateIssueDraft) => void;
}>((set) => ({
  open: false,
  draft: null,
  setOpen: (open) => set(open ? { open } : { open, draft: null }),
  openWithDraft: (draft) => set({ open: true, draft }),
}));
