import { compareCommits } from "../github-api";
import { withGithubToken } from "../with-github-token";
import { presentFile } from "./list-pull-request-files";

export async function comparePullRequestCommits(
  userId: string,
  owner: string,
  repo: string,
  base: string,
  head: string,
) {
  const result = await withGithubToken(userId, (token) =>
    compareCommits(token, owner, repo, base, head),
  );
  return (result.files ?? []).map(presentFile);
}
