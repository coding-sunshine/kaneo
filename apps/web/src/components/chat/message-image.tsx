/** An image sent with a message, shown in place; it opens full size. */
export function MessageImage({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-md border"
    >
      <img
        src={url}
        alt={filename}
        loading="lazy"
        className="max-h-72 max-w-full object-contain"
      />
    </a>
  );
}
