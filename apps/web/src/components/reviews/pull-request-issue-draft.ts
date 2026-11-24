import type { CreateIssueDraft } from "@/store/create-issue";

type DraftSource = {
  title: string;
  url: string;
  status: "draft" | "open" | "merged" | "closed";
};

/** "Create new issue" from a pull request: its title, a link back, and the pull request attached. */
export const buildPullRequestIssueDraft = ({
  title,
  url,
  status,
}: DraftSource): CreateIssueDraft => ({
  title,
  description: `[${title}](${url})`,
  pullRequest: { url, status },
});
