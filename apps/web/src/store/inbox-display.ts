import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type InboxDisplayStore = {
  ordering: "newest" | "oldest";
  showSnoozed: boolean;
  showUnreadFirst: boolean;
  set: (patch: Partial<Omit<InboxDisplayStore, "set">>) => void;
};

export const useInboxDisplayStore = create<InboxDisplayStore>()(
  persist(
    (set) => ({
      ordering: "newest",
      showSnoozed: false,
      showUnreadFirst: false,
      set: (patch) => set(patch),
    }),
    { name: "inbox-display", storage: createJSONStorage(() => localStorage) },
  ),
);
