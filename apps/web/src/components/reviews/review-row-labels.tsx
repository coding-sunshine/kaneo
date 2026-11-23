const MAX = 2;

/** Small colored-dot chips for the pull request's GitHub labels. */
export function ReviewRowLabels({
  labels,
}: {
  labels: { name: string; color: string }[];
}) {
  if (labels.length === 0) return null;
  return (
    <ul className="flex shrink-0 items-center gap-1">
      {labels.slice(0, MAX).map((label) => (
        <li
          key={label.name}
          className="inline-flex max-w-24 items-center gap-1 rounded-full border px-1.5 text-muted-foreground text-xs"
        >
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: `#${label.color}` }}
          />
          <span className="truncate">{label.name}</span>
        </li>
      ))}
      {labels.length > MAX && (
        <li className="text-muted-foreground text-xs">
          +{labels.length - MAX}
        </li>
      )}
    </ul>
  );
}
