import { requestReviewers } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function requestPullRequestReviewers(
  userId: string,
  owner: string,
  repo: string,
  number: string,
  reviewers: string[],
) {
  await withGithubToken(userId, (token) =>
    requestReviewers(token, owner, repo, number, reviewers),
  );
  return { ok: true as const };
}
