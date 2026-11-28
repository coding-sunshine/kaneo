import { useTranslation } from "react-i18next";
import {
  type CopyablePull,
  issueUrl,
  numberOnly,
  numberWithRepo,
  promptText,
  reviewUrl,
  titleLink,
} from "@/components/reviews/pull-request-copy";
import {
  failingCheckLines,
  unresolvedCommentLines,
} from "@/components/reviews/pull-request-prompt-sections";
import {
  checksQuery,
  conversationQuery,
} from "@/hooks/queries/github-reviews/pull-request-queries";
import { copyHtml } from "@/lib/copy-html";
import { copyText, copyTextAsync } from "@/lib/copy-text";
import queryClient from "@/query-client";

// Checks and threads are not loaded for list rows, so the prompt fetches them on demand;
// a page that already loaded them this recently supplies them from the cache. A failed fetch
// only drops its own section; the rest of the prompt is still worth copying.
const FRESH_MS = 30_000;

/** Every Copy action for a pull request; the menus only choose which to show. */
export function usePullRequestCopy(pull: CopyablePull, workspaceId: string) {
  const { t } = useTranslation();
  const done = t("workspace:reviews.copyMenu.copied");
  const failed = t("workspace:reviews.copyMenu.copyFailed");
  const copy = (text: string) => copyText(text, done, failed);

  return {
    asPrompt: () => {
      const { origin } = window.location;
      const id = numberWithRepo(pull);
      const ref = {
        owner: pull.owner,
        repo: pull.repo,
        number: String(pull.number),
      };
      // The write starts inside the click; see copyTextAsync.
      return copyTextAsync(
        Promise.all([
          queryClient
            .fetchQuery({ ...checksQuery(ref), staleTime: FRESH_MS })
            .catch(() => null),
          queryClient
            .fetchQuery({ ...conversationQuery(ref), staleTime: FRESH_MS })
            .catch(() => null),
        ]).then(([checks, conversation]) =>
          promptText({
            branch:
              pull.headRef &&
              t("workspace:reviews.copyMenu.promptCheckout", {
                branch: pull.headRef,
              }),
            review: t("workspace:reviews.copyMenu.promptReview", {
              id,
              url: reviewUrl(origin, workspaceId, pull),
            }),
            pull: t("workspace:reviews.copyMenu.promptPull", {
              id,
              url: pull.url,
            }),
            issue: pull.issue && {
              heading: t("workspace:reviews.copyMenu.promptIssue"),
              title: pull.issue.title,
              url: issueUrl(origin, pull.issue),
            },
            failingChecks: {
              heading: t("workspace:reviews.copyMenu.promptFailingChecks"),
              items: checks ? failingCheckLines(checks.checks) : [],
            },
            unresolvedComments: {
              heading: t("workspace:reviews.copyMenu.promptUnresolved"),
              items: conversation
                ? unresolvedCommentLines(conversation, {
                    more: (count) =>
                      t("workspace:reviews.copyMenu.promptUnresolvedMore", {
                        count,
                      }),
                    threadsUnknown: t(
                      "workspace:reviews.copyMenu.promptThreadsUnknown",
                    ),
                  })
                : [],
            },
          }),
        ),
        t("workspace:reviews.copyMenu.promptCopied"),
        failed,
        t("workspace:reviews.copyMenu.promptFailed"),
      );
    },
    numberOnly: () => copy(numberOnly(pull)),
    numberWithRepo: () => copy(numberWithRepo(pull)),
    reviewUrl: () => copy(reviewUrl(window.location.origin, workspaceId, pull)),
    titleAsLink: () => {
      const link = titleLink(pull);
      return copyHtml(link.html, link.text, done, failed);
    },
    branch: pull.headRef ? () => copy(pull.headRef as string) : null,
    githubUrl: () => copy(pull.url),
  };
}
