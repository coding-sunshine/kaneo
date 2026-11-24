import type {
  ConversationEntry,
  PullRequestChecks,
} from "@/fetchers/github-reviews/github-reviews";

// Not observed in Linear; keeps a pull request with many threads from burying the rest.
const LIMIT = 20;
const BODY_LIMIT = 200;

/** One markdown bullet per failing check, linked when the check has a page. */
export function failingCheckLines(checks: PullRequestChecks["checks"]) {
  return checks
    .filter((check) => check.state === "failure")
    .slice(0, LIMIT)
    .map((check) => {
      const name = check.name.replace(/[[\]]/g, "\\$&");
      return check.url
        ? `- [${name}](${check.url.replace(/\)/g, "%29")})`
        : `- ${name}`;
    });
}

/** Inline comments in threads GitHub reports as open; a comment with no reported state is skipped. */
export function unresolvedCommentLines(conversation: ConversationEntry[]) {
  return conversation
    .filter(
      (entry) => entry.kind === "review_comment" && entry.resolved === false,
    )
    .slice(0, LIMIT)
    .map((entry) => {
      const body = entry.body.replace(/\s+/g, " ").trim();
      // Code points, so an emoji at the cut is not split into a lone surrogate.
      const chars = Array.from(body);
      const text =
        chars.length > BODY_LIMIT
          ? `${chars.slice(0, BODY_LIMIT).join("")}…`
          : body;
      const place = entry.line ? `${entry.path}:${entry.line}` : entry.path;
      return `- ${place} ${entry.author ? `@${entry.author.login} ` : ""}${text}`;
    });
}
