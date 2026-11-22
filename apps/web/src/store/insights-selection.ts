import { create } from "zustand";

/** Issues picked in the Insights panel; the issue view shows only these. Null: no filter. */
export const useInsightsSelectionStore = create<{
  ids: ReadonlySet<string> | null;
  setIds: (ids: ReadonlySet<string> | null) => void;
}>((set) => ({
  ids: null,
  setIds: (ids) => set({ ids }),
}));
