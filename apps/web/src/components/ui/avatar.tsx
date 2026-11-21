"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "@/lib/cn";
import { resolveAvatarSrc } from "@/lib/resolve-avatar-src";

function Avatar({ className, ...props }: AvatarPrimitive.Root.Props) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle font-medium text-xs",
        className,
      )}
      data-slot="avatar"
      {...props}
    />
  );
}

function AvatarImage({
  className,
  src,
  ...props
}: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      className={cn("size-full object-cover", className)}
      data-slot="avatar-image"
      src={typeof src === "string" ? resolveAvatarSrc(src) : src}
      {...props}
    />
  );
}

// Linear gives each initials avatar its own color. ponytail: hashed from the
// initials rather than the user id, so people with the same initials match.
const INITIALS_COLORS = [
  "#3f9e6b",
  "#1f8fa6",
  "#2f74d0",
  "#5e6ad2",
  "#8b5cc4",
  "#c43f7e",
  "#d0663a",
  "#a0703a",
];

function initialsColor(initials: string) {
  let hash = 0;
  for (const char of initials) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return INITIALS_COLORS[hash % INITIALS_COLORS.length];
}

function AvatarFallback({
  className,
  children,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  const tint =
    typeof children === "string" && /^[\p{L}\p{N}]{1,3}$/u.test(children)
      ? initialsColor(children.toUpperCase())
      : undefined;
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      data-slot="avatar-fallback"
      style={
        tint
          ? { backgroundColor: tint, borderColor: tint, color: "#fff" }
          : undefined
      }
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  );
}

export { Avatar, AvatarFallback, AvatarImage };
