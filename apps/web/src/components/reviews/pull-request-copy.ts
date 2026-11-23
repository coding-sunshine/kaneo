export type CopyablePull = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Missing where the list does not carry it; the branch item is then left out. */
  headRef?: string;
  body?: string;
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

// ponytail: Linear's exact "Copy as prompt" layout is unknown; this is
// title, URL, branch and body when present. Match Linear once it is seen.
export function promptText(
  pull: CopyablePull,
  labels: { title: string; url: string; branch: string },
) {
  return [
    labels.title,
    labels.url,
    pull.headRef ? labels.branch : "",
    pull.body?.trim() ? `\n${pull.body.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ponytail: Linear's "Number only" format was not observed; "#7" and
// "owner/repo#7" are GitHub's own reference forms.
export const numberOnly = (pull: CopyablePull) => `#${pull.number}`;
export const numberWithRepo = (pull: CopyablePull) =>
  `${pull.owner}/${pull.repo}#${pull.number}`;

export const reviewUrl = (
  origin: string,
  workspaceId: string,
  pull: CopyablePull,
) =>
  `${origin}/dashboard/workspace/${workspaceId}/reviews/${pull.owner}/${pull.repo}/${pull.number}`;
