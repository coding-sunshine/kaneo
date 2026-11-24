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
import { copyHtml } from "@/lib/copy-html";
import { copyText } from "@/lib/copy-text";

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
      return copyText(
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
        }),
        t("workspace:reviews.copyMenu.promptCopied"),
        failed,
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
