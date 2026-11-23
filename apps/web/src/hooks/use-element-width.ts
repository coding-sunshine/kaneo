import { useEffect, useState } from "react";

/** The element's width (padding included) as it resizes; null until measured or without ResizeObserver. */
export function useElementWidth() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}
