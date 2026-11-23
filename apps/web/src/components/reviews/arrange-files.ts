import {
  CATEGORIES,
  type Category,
} from "@/components/reviews/file-categories";

type Changed = { filename: string; additions: number; deletions: number };

export type Arrangement = {
  order: "path" | "changes";
  desc: boolean;
  group: "none" | "type";
};

export type Section<T> = { category: Category | null; files: T[] };

/** Orders the files, then splits them into one section per category when grouped. */
export function arrangeFiles<T extends Changed>(
  files: T[],
  categoryOf: (path: string) => Category,
  { order, desc, group }: Arrangement,
): Section<T>[] {
  const sorted = [...files].sort((a, b) =>
    order === "changes"
      ? a.additions + a.deletions - (b.additions + b.deletions)
      : a.filename < b.filename
        ? -1
        : a.filename > b.filename
          ? 1
          : 0,
  );
  if (desc) sorted.reverse();
  if (group === "none") return [{ category: null, files: sorted }];
  return CATEGORIES.map((category) => ({
    category,
    files: sorted.filter((file) => categoryOf(file.filename) === category),
  })).filter((section) => section.files.length > 0);
}

export type TreeNode<T> =
  | { kind: "dir"; name: string; path: string; children: TreeNode<T>[] }
  | { kind: "file"; name: string; file: T };

/** Nests the files by folder, in the order given; a folder with one folder in it joins its name. */
export function buildTree<T extends { filename: string }>(
  files: T[],
): TreeNode<T>[] {
  const root: TreeNode<T>[] = [];
  for (const file of files) {
    const parts = file.filename.split("/");
    let level = root;
    parts.slice(0, -1).forEach((name, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let dir = level.find((node) => node.kind === "dir" && node.path === path);
      if (!dir) {
        dir = { kind: "dir", name, path, children: [] };
        level.push(dir);
      }
      level = (dir as Extract<TreeNode<T>, { kind: "dir" }>).children;
    });
    level.push({ kind: "file", name: parts[parts.length - 1], file });
  }
  const join = (nodes: TreeNode<T>[]): TreeNode<T>[] =>
    nodes.map((node) => {
      if (node.kind === "file") return node;
      let current = node;
      while (
        current.children.length === 1 &&
        current.children[0].kind === "dir"
      ) {
        const [only] = current.children;
        current = {
          ...only,
          name: `${current.name}/${only.name}`,
        } as typeof node;
      }
      return { ...current, children: join(current.children) };
    });
  return join(root);
}
