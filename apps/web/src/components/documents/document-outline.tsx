import { type RefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { occurrenceKeys } from "./occurrence-keys";
import { activeHeadingIndex } from "./outline-active-heading";

const HEADINGS = [1, 2, 3, 4]
  .map((level) => `.ProseMirror h${level}`)
  .join(", ");

type Outline = { headings: HTMLElement[]; active: number };

/**
 * Linear's outline rail: a short dash per heading at the left edge, the one
 * in view darker. Hovering opens the heading names; a click scrolls there.
 * It reads the editor's headings from the page, so it follows typing too.
 */
export function DocumentOutline({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const [{ headings, active }, setOutline] = useState<Outline>({
    headings: [],
    active: 0,
  });

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const read = () => {
      const found = Array.from(root.querySelectorAll<HTMLElement>(HEADINGS));
      const top = root.getBoundingClientRect().top;
      // The last headings may never reach the top; at the end, the last one is in view.
      const atEnd =
        root.scrollHeight > root.clientHeight &&
        root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      setOutline({
        headings: found,
        active: atEnd
          ? found.length - 1
          : activeHeadingIndex(
              found.map((heading) => heading.getBoundingClientRect().top - top),
            ),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    root.addEventListener("scroll", read, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", read);
    };
  }, [scrollRef]);

  if (!headings.length) return null;
  const keys = occurrenceKeys(
    headings.map((heading) => heading.textContent?.trim() ?? ""),
  );
  return (
    <nav
      aria-label={t("navigation:documents.outline")}
      className="group/outline absolute top-24 left-1 z-10 hidden md:block"
    >
      <ul className="flex max-h-[60vh] flex-col overflow-y-auto rounded-lg border border-transparent px-2 py-1.5 transition-colors group-hover/outline:border-border group-hover/outline:bg-popover group-hover/outline:shadow-md">
        {headings.map((heading, index) => {
          const text = heading.textContent?.trim() ?? "";
          const level = Number(heading.tagName.slice(1)) || 1;
          const current = index === active;
          return (
            <li key={keys[index]}>
              <button
                type="button"
                aria-label={text}
                aria-current={current ? "location" : undefined}
                onClick={() =>
                  heading.scrollIntoView({ block: "start", behavior: "smooth" })
                }
                className="flex h-2 w-full items-center gap-2.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/outline:h-6"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-px shrink-0 rounded-full transition-all",
                    current
                      ? "w-3 bg-foreground"
                      : "w-2 bg-muted-foreground/50",
                  )}
                />
                <span
                  aria-hidden
                  style={{ paddingInlineStart: (level - 1) * 8 }}
                  className={cn(
                    "hidden max-w-56 truncate text-xs group-hover/outline:block",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
