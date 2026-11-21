import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";

/** Avatar and name, as in the share popover's people rows. */
export function DocumentPerson({
  name,
  image,
}: {
  name: string | null;
  image: string | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-5">
        <AvatarImage src={image ?? ""} alt="" />
        <AvatarFallback className="bg-muted font-semibold text-[9px]">
          {getInitials(name ?? "")}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-[13px]">{name}</span>
    </span>
  );
}
