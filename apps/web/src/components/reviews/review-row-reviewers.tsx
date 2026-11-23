import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MAX = 3;

/** Overlapping avatars of the people asked to review or who already did. */
export function ReviewRowReviewers({
  reviewers,
}: {
  reviewers: { login: string; avatarUrl: string }[];
}) {
  if (reviewers.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center -space-x-1">
      {reviewers.slice(0, MAX).map((person) => (
        <Avatar
          key={person.login}
          className="size-4.5 ring-2 ring-background"
          title={person.login}
        >
          <AvatarImage src={person.avatarUrl} alt={person.login} />
          <AvatarFallback>{person.login.slice(0, 2)}</AvatarFallback>
        </Avatar>
      ))}
      {reviewers.length > MAX && (
        <span className="ps-2 text-muted-foreground text-xs">
          +{reviewers.length - MAX}
        </span>
      )}
    </span>
  );
}
