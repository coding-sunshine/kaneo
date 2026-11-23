import {
  listIssueComments,
  listReviewComments,
  listReviews,
} from "../github-api";
import { withGithubToken } from "../with-github-token";
import { person } from "./get-pull-request";

export async function listPullRequestConversation(
  userId: string,
  owner: string,
  repo: string,
  number: string,
) {
  const [comments, reviews, inline] = await withGithubToken(userId, (token) =>
    Promise.all([
      listIssueComments(token, owner, repo, number),
      listReviews(token, owner, repo, number),
      listReviewComments(token, owner, repo, number),
    ]),
  );
  return [
    ...comments.map((comment) => ({
      id: `comment-${comment.id}`,
      kind: "comment" as const,
      author: person(comment.user),
      body: comment.body,
      reviewState: null,
      path: null,
      line: null,
      side: null,
      createdAt: comment.created_at,
    })),
    ...inline.map((comment) => ({
      id: `review-comment-${comment.id}`,
      kind: "review_comment" as const,
      author: person(comment.user),
      body: comment.body,
      reviewState: null,
      path: comment.path,
      line: comment.line ?? comment.original_line,
      side: comment.side,
      createdAt: comment.created_at,
    })),
    // A review with no body and state COMMENTED only carries inline comments.
    ...reviews
      .filter(
        (review) =>
          review.submitted_at && (review.body || review.state !== "COMMENTED"),
      )
      .map((review) => ({
        id: `review-${review.id}`,
        kind: "review" as const,
        author: person(review.user),
        body: review.body,
        reviewState: review.state,
        path: null,
        line: null,
        side: null,
        createdAt: review.submitted_at as string,
      })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
