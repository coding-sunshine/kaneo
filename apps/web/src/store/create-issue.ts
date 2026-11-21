import { create } from "zustand";

// Lets any "New issue" button open the global create modal owned by the command palette.
export const useCreateIssueStore = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
