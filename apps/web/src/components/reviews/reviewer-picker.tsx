import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import {
  useRequestReviewers,
  useReviewerCandidates,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

/** Search box plus candidate list; picking one asks them to review on GitHub. Mount it only while shown. */
export function ReviewerPicker({
  pullRef,
  pull,
  onDone,
}: {
  pullRef: PullRef;
  pull: Pick<PullRequestDetail, "author" | "requestedReviewers">;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const candidates = useReviewerCandidates(pullRef, true);
  const request = useRequestReviewers(pullRef);
  const taken = new Set([
    pull.author?.login,
    ...pull.requestedReviewers.map((person) => person.login),
  ]);
  const people = (candidates.data ?? []).filter(
    (person) =>
      !taken.has(person.login) &&
      person.login.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <Input
        size="sm"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("workspace:reviews.detail.selectReviewers")}
        aria-label={t("workspace:reviews.detail.selectReviewers")}
      />
      <ul className="mt-1 flex max-h-64 flex-col overflow-y-auto">
        {people.map((person) => (
          <li key={person.login}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
              disabled={request.isPending}
              onClick={() =>
                request.mutate([person.login], {
                  onSuccess: onDone,
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              <Avatar className="size-5">
                <AvatarImage src={person.avatarUrl} alt="" />
                <AvatarFallback>{person.login.slice(0, 2)}</AvatarFallback>
              </Avatar>
              {person.login}
            </button>
          </li>
        ))}
      </ul>
      {!candidates.isLoading && people.length === 0 && (
        <p className="px-2 py-1.5 text-muted-foreground text-sm">
          {t("workspace:reviews.detail.noReviewers")}
        </p>
      )}
    </>
  );
}
