import { Hash, Lock, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/** `#` for a public channel, a lock for a private one, a bubble for a direct message. */
export function ChannelIcon({
  isPrivate,
  isDirect = false,
  className,
}: {
  isPrivate: boolean;
  isDirect?: boolean;
  className?: string;
}) {
  const Icon = isDirect ? MessageCircle : isPrivate ? Lock : Hash;
  return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />;
}
