import { useEffect, useState } from "react";
import { documentEditors } from "@/lib/document-editors";

/** The names of the people typing in a document now, newest last. */
export function useDocumentEditors(documentId: string) {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      const now = Date.now();
      const hints = documentEditors.current(documentId, now);
      const next = hints.map((hint) => hint.name);
      setNames((previous) =>
        previous.join("\n") === next.join("\n") ? previous : next,
      );
      if (hints.length)
        timer = setTimeout(
          update,
          Math.min(...hints.map((hint) => hint.until)) - now,
        );
    };
    update();
    const unsubscribe = documentEditors.subscribe(update);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [documentId]);
  return names;
}
