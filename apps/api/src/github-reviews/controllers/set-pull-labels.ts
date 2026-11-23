import { setPullLabels } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function setPullRequestLabels(
  userId: string,
  owner: string,
  repo: string,
  number: string,
  labels: string[],
) {
  await withGithubToken(userId, (token) =>
    setPullLabels(token, owner, repo, number, labels),
  );
  return { ok: true as const };
}
