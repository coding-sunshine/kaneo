import { getTaskPath } from "@/lib/task-link";

export type CopyablePull = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Missing where the list does not carry it; the branch item is then left out. */
  headRef?: string;
  /** The linked task; "Copy as prompt" names it. */
  issue?: {
    workspaceId: string;
    taskId: string;
    title: string;
    team: { id: string };
  } | null;
};

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The title as a link, in the two forms the clipboard carries. */
export const titleLink = ({ title, url }: CopyablePull) => ({
  html: `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`,
  text: `[${title}](${url})`,
});

/**
 * "Copy as prompt" layout: the branch to check out, the review and pull request links, the
 * connected issue, then the failing checks and unresolved comments when there are any.
 * Linear's section headings and line formats were not observed; these are our own.
 */
export function promptText(lines: {
  branch?: string;
  review: string;
  pull: string;
  issue?: { heading: string; title: string; url: string } | null;
  failingChecks?: { heading: string; items: string[] };
  unresolvedComments?: { heading: string; items: string[] };
}) {
  const { issue } = lines;
  const list = (section?: { heading: string; items: string[] }) =>
    section?.items.length
      ? `\n${section.heading}\n${section.items.join("\n")}`
      : "";
  return [
    lines.branch ? `${lines.branch}\n` : "",
    lines.review,
    lines.pull,
    issue ? `\n${issue.heading}\n- [${issue.title}](${issue.url})` : "",
    list(lines.failingChecks),
    list(lines.unresolvedComments),
  ]
    .filter(Boolean)
    .join("\n");
}

// ponytail: Linear's "Number only" format was not observed; "#7" and
// "owner/repo#7" are GitHub's own reference forms.
export const numberOnly = (pull: CopyablePull) => `#${pull.number}`;
export const numberWithRepo = (pull: CopyablePull) =>
  `${pull.owner}/${pull.repo}#${pull.number}`;

/** Uses the task's own workspace: a linked task can live outside the one Reviews is open in. */
export const issueUrl = (
  origin: string,
  issue: NonNullable<CopyablePull["issue"]>,
) =>
  origin +
  getTaskPath({
    workspaceId: issue.workspaceId,
    projectId: issue.team.id,
    taskId: issue.taskId,
  });

export const reviewUrl = (
  origin: string,
  workspaceId: string,
  pull: CopyablePull,
) =>
  `${origin}/dashboard/workspace/${workspaceId}/reviews/${pull.owner}/${pull.repo}/${pull.number}`;
