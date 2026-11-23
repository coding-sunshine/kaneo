import { useEffect, useState } from "react";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { readReviewed, writeReviewed } from "@/lib/reviewed-files";

/**
 * Files the reader ticked as reviewed, kept for this pull request's head commit.
 * ponytail: stored per device in localStorage, so it does not follow the person
 * to another browser; sync it through a per-user table if that is asked for.
 */
export function useReviewedFiles(ref: PullRef, headSha: string | undefined) {
  const { owner, repo, number } = ref;
  const [files, setFiles] = useState(() => readReviewed(ref, headSha));
  useEffect(() => {
    setFiles(readReviewed({ owner, repo, number }, headSha));
  }, [owner, repo, number, headSha]);
  const setReviewed = (filename: string, reviewed: boolean) => {
    const next = [...files.filter((name) => name !== filename)];
    if (reviewed) next.push(filename);
    setFiles(next);
    writeReviewed(ref, headSha, next);
  };
  return [files, setReviewed] as const;
}
