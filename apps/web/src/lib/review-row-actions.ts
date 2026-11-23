import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";

type ActionSubject = Pick<ReviewPullRequest, "status" | "hasConflicts">;

/** Which GitHub writes the row menu offers for a pull request in this state. */
export function rowActions(pr: ActionSubject) {
  const live = pr.status === "open" || pr.status === "draft";
  return {
    /** Labels and reviewers can only change while the pull request is live. */
    edit: live,
    convertToDraft: pr.status === "open",
    squash: pr.status === "open",
    squashEnabled: !pr.hasConflicts,
    close: live,
  };
}

/** The list carries requested and reviewed people together; the picker needs only the requested. */
export const requestedReviewers = (
  pr: Pick<
    ReviewPullRequest,
    "reviewers" | "approvedBy" | "changesRequestedBy"
  >,
) =>
  pr.reviewers.filter(
    (person) =>
      !pr.approvedBy.includes(person.login) &&
      !pr.changesRequestedBy.includes(person.login),
  );
