import { type GithubFile, listPullFiles } from "../github-api";
import { withGithubToken } from "../with-github-token";

export const presentFile = (file: GithubFile) => ({
  filename: file.filename,
  status: file.status,
  additions: file.additions,
  deletions: file.deletions,
  // GitHub omits the patch for binary and very large files.
  patch: file.patch ?? null,
});

export async function listPullRequestFiles(
  userId: string,
  owner: string,
  repo: string,
  number: string,
) {
  const files = await withGithubToken(userId, (token) =>
    listPullFiles(token, owner, repo, number),
  );
  return files.map(presentFile);
}
