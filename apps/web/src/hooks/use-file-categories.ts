import { useMemo } from "react";
import {
  type Category,
  categorize,
  parseGitattributes,
} from "@/components/reviews/file-categories";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { useFileContent } from "@/hooks/queries/github-reviews/use-github-reviews";

/** Places a path in a category from the repo's .gitattributes at the head commit. */
export function useFileCategories(ref: PullRef, headSha: string | undefined) {
  const attributes = useFileContent(ref, ".gitattributes", headSha, true);
  const text = attributes.data?.content ?? "";
  return useMemo(() => {
    const rules = parseGitattributes(text);
    return (path: string): Category => categorize(path, rules);
  }, [text]);
}
