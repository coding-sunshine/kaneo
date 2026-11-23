import { FileIcon } from "@/components/reviews/file-icon";

/** One row of the file-list column, linking to the file's diff. */
export function FileListItem({
  filename,
  name,
  additions,
  deletions,
  showCounts,
  depth,
}: {
  filename: string;
  name: string;
  additions: number;
  deletions: number;
  showCounts: boolean;
  depth: number;
}) {
  return (
    <a
      href={`#file-${filename}`}
      title={filename}
      style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      className="flex h-8 items-center gap-2 rounded-md pr-2 hover:bg-accent"
    >
      <FileIcon filename={filename} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {showCounts && (
        <>
          <span className="shrink-0 text-success-foreground tabular-nums">
            +{additions}
          </span>
          <span className="shrink-0 text-destructive-foreground tabular-nums">
            -{deletions}
          </span>
        </>
      )}
    </a>
  );
}
