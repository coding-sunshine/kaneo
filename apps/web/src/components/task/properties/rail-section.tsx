import type { ReactNode } from "react";

type RailSectionProps = {
  title: string;
  children: ReactNode;
};

/** Linear's right-rail group: a muted heading over value-only rows. */
export function RailSection({ title, children }: RailSectionProps) {
  return (
    <section className="flex flex-col">
      <h3 className="flex h-8 items-center px-2 font-normal text-[13px] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
