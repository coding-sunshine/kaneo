import { describe, expect, it } from "vite-plus/test";
import type { GithubSearchPull } from "./github-api";
import { toMergeState, toReviewFields } from "./review-fields";

const pull = (over: Partial<GithubSearchPull>) => over as GithubSearchPull;
const author = { login: "synthetic-author", avatarUrl: "a.png" };

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
            { requestedReviewer: { __typename: "User", ...author } },
            { requestedReviewer: { __typename: "Team", slug: "core" } },
            { requestedReviewer: null },
          ],
        },
        latestOpinionatedReviews: {
          nodes: [
            { state: "APPROVED", author },
            {
              state: "CHANGES_REQUESTED",
              author: { ...author, login: "synthetic-reviewer" },
            },
            { state: "APPROVED", author: null },
          ],
        },
      }),
    );
    expect(fields.reviewers.map((p) => p.login)).toEqual([
      "synthetic-author",
      "synthetic-reviewer",
    ]);
    expect(fields.teamReviewers).toEqual(["core"]);
    expect(fields.approvedBy).toEqual(["synthetic-author"]);
    expect(fields.changesRequestedBy).toEqual(["synthetic-reviewer"]);
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
