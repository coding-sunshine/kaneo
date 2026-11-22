import { submitReview as submitGithubReview } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function submitReview(
  userId: string,
  owner: string,
  repo: string,
  number: string,
  review: { event: string; body: string },
) {
  await withGithubToken(userId, (token) =>
    submitGithubReview(token, owner, repo, number, review),
  );
  return { ok: true as const };
}
