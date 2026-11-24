import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_DIFF_OPTIONS,
  type DiffOptions,
} from "@/components/reviews/diff-options-menu";

type ReviewsDiffOptionsStore = {
  options: DiffOptions;
  set: (patch: Partial<DiffOptions>) => void;
};

// ponytail: per-browser like the other view options, one set for every pull request.
export const useReviewsDiffOptionsStore = create<ReviewsDiffOptionsStore>()(
  persist(
    (set) => ({
      options: DEFAULT_DIFF_OPTIONS,
      set: (patch) =>
        set(({ options }) => ({ options: { ...options, ...patch } })),
    }),
    {
      name: "reviews-diff-options",
      storage: createJSONStorage(() => localStorage),
      // A saved set from before an option existed keeps that option's default.
      merge: (persisted, current) => ({
        ...current,
        options: {
          ...DEFAULT_DIFF_OPTIONS,
          ...(persisted as Partial<ReviewsDiffOptionsStore> | undefined)
            ?.options,
        },
      }),
    },
  ),
);
