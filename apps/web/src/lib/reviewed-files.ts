import type { PullRef } from "@/fetchers/github-reviews/github-reviews";

// A new push changes the head SHA, so the ticks start over with the new code.
const key = (ref: PullRef, headSha: string) =>
  `kaneo:reviewed:${ref.owner}/${ref.repo}#${ref.number}@${headSha}`;

export function readReviewed(ref: PullRef, headSha: string | undefined) {
  if (!headSha) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key(ref, headSha)) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeReviewed(
  ref: PullRef,
  headSha: string | undefined,
  files: string[],
) {
  if (!headSha) return;
  try {
    localStorage.setItem(key(ref, headSha), JSON.stringify(files));
  } catch {
    // Storage can be full or blocked; the ticks then last until the page closes.
  }
}
