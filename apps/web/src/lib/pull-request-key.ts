import type { PullRef } from "@/fetchers/github-reviews/github-reviews";

/** The key of a pull request (its favorite targetId and snooze key), e.g. "acme/web#7". */
export const pullRequestKey = ({ owner, repo, number }: PullRef) =>
  `${owner}/${repo}#${number}`;

export function parsePullRequestKey(id: string): PullRef | null {
  const match = id.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  return match ? { owner: match[1], repo: match[2], number: match[3] } : null;
}
