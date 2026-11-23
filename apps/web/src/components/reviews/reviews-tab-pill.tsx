import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function ReviewsTabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      role="tab"
      aria-selected={active}
      variant="ghost"
      size="xs"
      onClick={onClick}
      className={cn(
        "gap-1.5 rounded-full px-2.5",
        // Linear outlines the idle tab and fills the selected one.
        active
          ? "border-transparent bg-accent text-foreground"
          : "border-border text-foreground",
      )}
    >
      {children}
    </Button>
  );
}
