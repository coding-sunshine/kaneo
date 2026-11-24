import type { ReactNode } from "react";

type TopicSectionProps = { id: string; title: string; children: ReactNode };

/** One labelled block of a topic page: current, proposals or replaced. */
export function TopicSection({ id, title, children }: TopicSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="px-4 font-medium text-muted-foreground text-xs">
        {title}
      </h2>
      {children}
    </section>
  );
}
