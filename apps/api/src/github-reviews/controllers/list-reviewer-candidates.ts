import { listAssignees } from "../github-api";
import { withGithubToken } from "../with-github-token";

/** People GitHub lets you assign in the repo, which are the people who can be asked to review. */
export async function listReviewerCandidates(
  userId: string,
  owner: string,
  repo: string,
) {
  const users = await withGithubToken(userId, (token) =>
    listAssignees(token, owner, repo),
  );
  return users.map((user) => ({
    login: user.login,
    avatarUrl: user.avatar_url,
  }));
}
