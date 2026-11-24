import { describe, expect, it } from "vite-plus/test";
import { toReviewOwner } from "./review-owner";

const ada = { userId: "u1", name: "Ada", image: null };
const bo = { userId: "u2", name: "Bo", image: "https://img.test/bo" };

describe("toReviewOwner", () => {
  it("defaults to the author's member", () => {
    expect(toReviewOwner(undefined, ada)).toEqual({
      reviewOwner: ada,
      originalAuthorUserId: "u1",
    });
  });

  it("lets a saved owner replace the author but still reports the author", () => {
    expect(toReviewOwner(bo, ada)).toEqual({
      reviewOwner: bo,
      originalAuthorUserId: "u1",
    });
  });

  it("has no owner when nobody maps", () => {
    expect(toReviewOwner(undefined, undefined)).toEqual({
      reviewOwner: null,
      originalAuthorUserId: null,
    });
  });

  it("keeps a saved owner when the author is not a member", () => {
    expect(toReviewOwner(bo, undefined)).toEqual({
      reviewOwner: bo,
      originalAuthorUserId: null,
    });
  });
});
