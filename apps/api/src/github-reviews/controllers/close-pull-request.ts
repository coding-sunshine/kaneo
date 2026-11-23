import { closePull } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function closePullRequest(
  userId: string,
  owner: string,
  repo: string,
  number: string,
) {
  await withGithubToken(userId, (token) =>
    closePull(token, owner, repo, number),
  );
  return { ok: true as const };
}
