import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { buildTree, type TreeNode } from "@/components/reviews/arrange-files";
import { FileListItem } from "@/components/reviews/file-list-item";

type Listed = { filename: string; additions: number; deletions: number };

/** The files as a flat list, or nested by folder with collapsible folders. */
export function FileList<T extends Listed>({
  files,
  tree,
  showCounts,
}: {
  files: T[];
  tree: boolean;
  showCounts: boolean;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (path: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const row = (file: T, name: string, depth: number) => (
    <li key={file.filename}>
      <FileListItem
        filename={file.filename}
        name={name}
        additions={file.additions}
        deletions={file.deletions}
        showCounts={showCounts}
        depth={depth}
      />
    </li>
  );
  const nodes = (list: TreeNode<T>[], depth: number): ReactNode =>
    list.map((node) => {
      if (node.kind === "file") return row(node.file, node.name, depth);
      const open = !closed.has(node.path);
      return (
        <li key={node.path}>
          <button
            type="button"
            aria-expanded={open}
            title={node.path}
            onClick={() => toggle(node.path)}
            style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
            className="flex h-8 w-full items-center gap-2 rounded-md pr-2 text-muted-foreground hover:bg-accent"
          >
            {open ? (
              <ChevronDown aria-hidden className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight aria-hidden className="size-3.5 shrink-0" />
            )}
            <span className="min-w-0 truncate">{node.name}</span>
          </button>
          {open && <ul>{nodes(node.children, depth + 1)}</ul>}
        </li>
      );
    });
  return (
    <ul className="flex flex-col text-[13px]">
      {tree
        ? nodes(buildTree(files), 0)
        : files.map((file) =>
            row(file, file.filename.split("/").pop() ?? "", 0),
          )}
    </ul>
  );
}
