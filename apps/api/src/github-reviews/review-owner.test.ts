import { describe, expect, it } from "vite-plus/test";
import { toReviewOwner } from "./review-owner";

const author = { userId: "u1", name: "Synthetic Author", image: null };
const reviewer = {
  userId: "u2",
  name: "Synthetic Reviewer",
  image: "https://img.test/reviewer",
};

describe("toReviewOwner", () => {
  it("defaults to the author's member", () => {
    expect(toReviewOwner(undefined, author)).toEqual({
      reviewOwner: author,
      originalAuthorUserId: "u1",
    });
  });

  it("lets a saved owner replace the author but still reports the author", () => {
    expect(toReviewOwner(reviewer, author)).toEqual({
      reviewOwner: reviewer,
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
    expect(toReviewOwner(reviewer, undefined)).toEqual({
      reviewOwner: reviewer,
      originalAuthorUserId: null,
    });
  });
});
