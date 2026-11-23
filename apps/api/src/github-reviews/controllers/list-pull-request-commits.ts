import { listPullCommits } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function listPullRequestCommits(
  userId: string,
  owner: string,
  repo: string,
  number: string,
) {
  const commits = await withGithubToken(userId, (token) =>
    listPullCommits(token, owner, repo, number),
  );
  return commits.map((entry) => ({
    sha: entry.sha,
    title: entry.commit.message.split("\n")[0],
    date: entry.commit.author?.date ?? null,
    parent: entry.parents[0]?.sha ?? null,
  }));
}
