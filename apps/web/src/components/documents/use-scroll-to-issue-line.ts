import { type RefObject, useEffect } from "react";

/** Opens at the checklist line of the issue named by `#issue-<id>`. */
export function useScrollToIssueLine(container: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const id = window.location.hash.match(/^#issue-([A-Za-z0-9]+)$/)?.[1];
    if (!id) return;
    let tries = 0;
    const timer = setInterval(() => {
      const link = container.current?.querySelector(`a[href*="/task/${id}"]`);
      if (!link && ++tries < 20) return;
      clearInterval(timer);
      const line = link?.closest("li") ?? link;
      line?.scrollIntoView({ block: "center" });
      line?.animate?.([{ backgroundColor: "rgba(250, 204, 21, 0.35)" }, {}], {
        duration: 1200,
      });
    }, 100);
    return () => clearInterval(timer);
  }, [container]);
}
