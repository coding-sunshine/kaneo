import { cn } from "@/lib/cn";

type PillTabsProps<T extends string> = {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Linear's rounded filter pills: the active one is filled. */
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: PillTabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex items-center gap-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "h-6 rounded-full px-3 text-xs",
            tab.value === value
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
