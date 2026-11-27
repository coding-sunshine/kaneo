import { splitLinks } from "@/lib/split-links";

/** Message text with its web links clickable; they open in a new tab. */
export function MessageBody({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {splitLinks(body).map((part, index) =>
        part.href ? (
          <a
            // Parts never reorder, so the index is a stable key.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}
