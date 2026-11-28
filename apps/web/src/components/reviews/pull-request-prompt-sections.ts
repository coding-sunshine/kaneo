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

type PromptLabels = {
  more: (count: number) => string;
  threadsUnknown: string;
};

const ENGLISH: PromptLabels = {
  more: (count) => `…and ${count} more`,
  threadsUnknown: "Thread state could not be loaded",
};

function commentLine(entry: ConversationEntry) {
  const body = entry.body.replace(/\s+/g, " ").trim();
  // Code points, so an emoji at the cut is not split into a lone surrogate.
  const chars = Array.from(body);
  const text =
    chars.length > BODY_LIMIT
      ? `${chars.slice(0, BODY_LIMIT).join("")}…`
      : body;
  const place = entry.line ? `${entry.path}:${entry.line}` : entry.path;
  return `- ${place} ${entry.author ? `@${entry.author.login} ` : ""}${text}`;
}

/**
 * Open thread roots only. A reply is not its own task. When more than LIMIT
 * roots are open, the last line says how many were left out. When review
 * comments arrived but none carried a thread flag, the lookup failed and the
 * list says so instead of looking empty.
 */
export function unresolvedCommentLines(
  conversation: ConversationEntry[],
  labels: PromptLabels = ENGLISH,
) {
  const inline = conversation.filter(
    (entry) => entry.kind === "review_comment",
  );
  const threadsUnknown =
    inline.length > 0 &&
    inline.every((entry) => typeof entry.resolved !== "boolean");
  const openRoots = inline.filter(
    (entry) => entry.resolved === false && entry.inReplyToId == null,
  );
  const lines = openRoots.slice(0, LIMIT).map(commentLine);
  const omitted = openRoots.length - lines.length;
  if (omitted > 0) lines.push(`- ${labels.more(omitted)}`);
  if (lines.length === 0 && threadsUnknown) {
    return [`- ${labels.threadsUnknown}`];
  }
  return lines;
}
