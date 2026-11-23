import { listRepoLabels } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function listLabels(userId: string, owner: string, repo: string) {
  const labels = await withGithubToken(userId, (token) =>
    listRepoLabels(token, owner, repo),
  );
  return labels.map(({ name, color }) => ({ name, color }));
}
