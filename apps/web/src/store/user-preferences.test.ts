import { describe, expect, it } from "vite-plus/test";
import { useUserPreferencesStore } from "./user-preferences";

describe("sidebar prefs rehydrate", () => {
  it("keeps new field defaults when a saved sidebar predates them", async () => {
    localStorage.setItem(
      "user-preferences",
      JSON.stringify({
        state: {
          sidebar: {
            visibility: { pulse: "never" },
            order: {},
            badgeStyle: "dot",
            itemBadges: {},
          },
        },
        version: 0,
      }),
    );
    await useUserPreferencesStore.persist.rehydrate();
    const { sidebar } = useUserPreferencesStore.getState();
    expect(sidebar.inboxCount).toBe("all");
    expect(sidebar.badgeStyle).toBe("dot");
    expect(sidebar.visibility.pulse).toBe("never");
  });
});
