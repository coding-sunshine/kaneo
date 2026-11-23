import { convertToDraft, getPull } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function convertPullRequestToDraft(
  userId: string,
  owner: string,
  repo: string,
  number: string,
) {
  await withGithubToken(userId, async (token) => {
    const pull = await getPull(token, owner, repo, number);
    await convertToDraft(token, pull.node_id);
  });
  return { ok: true as const };
}
