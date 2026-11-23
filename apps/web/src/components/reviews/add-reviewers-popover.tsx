import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import {
  useRequestReviewers,
  useReviewerCandidates,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

/** Linear's Add reviewers control: asks one more person on GitHub to review. */
export function AddReviewersPopover({
  pullRef,
  pull,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const candidates = useReviewerCandidates(pullRef, open);
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
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger className="-mx-1.5 inline-flex h-7 items-center gap-2 rounded-full px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent">
        <Plus aria-hidden className="size-3.5" />
        {t("workspace:reviews.detail.addReviewers")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
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
                    onSuccess: () => setOpen(false),
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
      </PopoverContent>
    </Popover>
  );
}
