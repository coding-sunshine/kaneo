import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_REVIEWS_VIEWS } from "@/lib/reviews-view";
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

describe("reviews view rehydrate", () => {
  it("replaces the flat view saved before tabs had their own", async () => {
    localStorage.setItem(
      "user-preferences",
      JSON.stringify({
        state: {
          reviewsView: {
            groupBy: "reviewStatus",
            subGroupBy: "none",
            sortBy: "title",
            pinned: ["status:open"],
          },
        },
        version: 0,
      }),
    );
    await useUserPreferencesStore.persist.rehydrate();
    expect(useUserPreferencesStore.getState().reviewsView).toEqual(
      DEFAULT_REVIEWS_VIEWS,
    );
  });

  it("changes one tab's view without touching the other", () => {
    useUserPreferencesStore.getState().setReviewsView("created", {
      groupBy: "author",
    });
    const { reviewsView } = useUserPreferencesStore.getState();
    expect(reviewsView.created.groupBy).toBe("author");
    expect(reviewsView.toReview).toEqual(DEFAULT_REVIEWS_VIEWS.toReview);
  });
});
