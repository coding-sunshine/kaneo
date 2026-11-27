import { Hash, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

/** `#` for a public channel, a lock for a private one. */
export function ChannelIcon({
  isPrivate,
  className,
}: {
  isPrivate: boolean;
  className?: string;
}) {
  const Icon = isPrivate ? Lock : Hash;
  return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />;
}
