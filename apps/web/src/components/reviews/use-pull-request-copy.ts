import { useTranslation } from "react-i18next";
import {
  type CopyablePull,
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
    asPrompt: () =>
      copy(
        promptText(pull, {
          title: t("workspace:reviews.copyMenu.promptTitle", {
            title: pull.title,
          }),
          url: t("workspace:reviews.copyMenu.promptUrl", { url: pull.url }),
          branch: t("workspace:reviews.copyMenu.promptBranch", {
            branch: pull.headRef,
          }),
        }),
      ),
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
