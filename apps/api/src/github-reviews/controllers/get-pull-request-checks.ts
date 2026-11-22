import { getCombinedStatus, getPull, listCheckRuns } from "../github-api";
import { withGithubToken } from "../with-github-token";

type State = "success" | "failure" | "pending";

const fromRun = (status: string, conclusion: string | null): State =>
  status !== "completed"
    ? "pending"
    : conclusion === "success" ||
        conclusion === "neutral" ||
        conclusion === "skipped"
      ? "success"
      : "failure";

export async function getPullRequestChecks(
  userId: string,
  owner: string,
  repo: string,
  number: string,
) {
  const [runs, combined] = await withGithubToken(userId, async (token) => {
    const sha = (await getPull(token, owner, repo, number)).head.sha;
    return Promise.all([
      listCheckRuns(token, owner, repo, sha),
      getCombinedStatus(token, owner, repo, sha),
    ]);
  });
  const checks = [
    ...runs.check_runs.map((run) => ({
      name: run.name,
      state: fromRun(run.status, run.conclusion),
      url: run.html_url,
    })),
    ...combined.statuses.map((status) => ({
      name: status.context,
      state: (status.state === "success"
        ? "success"
        : status.state === "pending"
          ? "pending"
          : "failure") as State,
      url: status.target_url,
    })),
  ];
  const state = !checks.length
    ? ("none" as const)
    : checks.some((check) => check.state === "failure")
      ? ("failure" as const)
      : checks.some((check) => check.state === "pending")
        ? ("pending" as const)
        : ("success" as const);
  return { state, checks };
}
