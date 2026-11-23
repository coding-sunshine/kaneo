import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SnoozeEntry } from "@/lib/reviews-snooze";

type ReviewsSnoozeStore = {
  /** Snoozes by pull request key ("owner/repo#number"), kept per browser. */
  entries: Record<string, SnoozeEntry>;
  snooze: (key: string, entry: SnoozeEntry) => void;
  unsnooze: (key: string) => void;
};

export const useReviewsSnoozeStore = create<ReviewsSnoozeStore>()(
  persist(
    (set) => ({
      entries: {},
      snooze: (key, entry) =>
        set((state) => ({ entries: { ...state.entries, [key]: entry } })),
      unsnooze: (key) =>
        set((state) => {
          const { [key]: _removed, ...entries } = state.entries;
          return { entries };
        }),
    }),
    {
      name: "reviews-snooze",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
