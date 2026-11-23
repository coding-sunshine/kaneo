import { addIssueComment } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function addComment(
  userId: string,
  owner: string,
  repo: string,
  number: string,
  body: string,
) {
  await withGithubToken(userId, (token) =>
    addIssueComment(token, owner, repo, number, body),
  );
  return { ok: true as const };
}
