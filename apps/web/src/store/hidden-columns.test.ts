import { expect, it } from "vite-plus/test";
import { columnKey, useUserPreferencesStore } from "./user-preferences";

it("hides and shows a column per project", () => {
  const { toggleColumnHidden } = useUserPreferencesStore.getState();
  toggleColumnHidden(columnKey("p1", "backlog"));
  expect(useUserPreferencesStore.getState().hiddenColumnIds).toEqual([
    "p1:backlog",
  ]);
  toggleColumnHidden(columnKey("p1", "backlog"));
  expect(useUserPreferencesStore.getState().hiddenColumnIds).toEqual([]);
});
