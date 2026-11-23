import { getFileContent } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function getPullRequestFileContent(
  userId: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
) {
  const file = await withGithubToken(userId, (token) =>
    getFileContent(token, owner, repo, path, ref),
  );
  // GitHub sends no inline content for directories and files over 1 MB.
  if (Array.isArray(file) || file.type !== "file" || !file.content) {
    return { content: null };
  }
  const text = Buffer.from(file.content, "base64").toString("utf8");
  // A NUL byte means binary; there are no lines to show.
  return { content: text.includes("\0") ? null : text };
}
