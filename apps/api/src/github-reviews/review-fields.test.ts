import { describe, expect, it } from "vite-plus/test";
import type { GithubSearchPull } from "./github-api";
import { toMergeState, toReviewFields } from "./review-fields";

const pull = (over: Partial<GithubSearchPull>) => over as GithubSearchPull;
const ada = { login: "ada", avatarUrl: "a.png" };

describe("toMergeState", () => {
  it("maps GitHub's merge state, with the merge queue first", () => {
    expect(toMergeState(pull({ mergeStateStatus: "CLEAN" }))).toBe("ready");
    expect(toMergeState(pull({ mergeStateStatus: "BEHIND" }))).toBe("behind");
    expect(toMergeState(pull({ mergeStateStatus: "DIRTY" }))).toBe("unknown");
    expect(
      toMergeState(
        pull({ mergeStateStatus: "CLEAN", mergeQueueEntry: { id: "q" } }),
      ),
    ).toBe("queued");
  });
});

describe("toReviewFields", () => {
  it("lists requested and reviewed people once, teams apart, and who approved", () => {
    const fields = toReviewFields(
      pull({
        reviewRequests: {
          nodes: [
            { requestedReviewer: { __typename: "User", ...ada } },
            { requestedReviewer: { __typename: "Team", slug: "core" } },
            { requestedReviewer: null },
          ],
        },
        latestOpinionatedReviews: {
          nodes: [
            { state: "APPROVED", author: ada },
            { state: "CHANGES_REQUESTED", author: { ...ada, login: "bo" } },
            { state: "APPROVED", author: null },
          ],
        },
      }),
    );
    expect(fields.reviewers.map((p) => p.login)).toEqual(["ada", "bo"]);
    expect(fields.teamReviewers).toEqual(["core"]);
    expect(fields.approvedBy).toEqual(["ada"]);
    expect(fields.changesRequestedBy).toEqual(["bo"]);
  });

  it("tolerates a pull request with none of it", () => {
    expect(toReviewFields(pull({}))).toEqual({
      reviewers: [],
      teamReviewers: [],
      approvedBy: [],
      changesRequestedBy: [],
    });
  });
});
