import { mergePull } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function mergePullRequest(
  userId: string,
  owner: string,
  repo: string,
  number: string,
  mergeMethod: string,
) {
  await withGithubToken(userId, (token) =>
    mergePull(token, owner, repo, number, mergeMethod),
  );
  return { ok: true as const };
}
