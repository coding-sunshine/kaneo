import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Person({
  author,
}: {
  author: { login: string; avatarUrl: string } | null;
}) {
  if (!author) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-foreground text-xs">
      <Avatar className="size-5">
        <AvatarImage src={author.avatarUrl} alt="" />
        <AvatarFallback>{author.login.slice(0, 2)}</AvatarFallback>
      </Avatar>
      {author.login}
    </span>
  );
}
