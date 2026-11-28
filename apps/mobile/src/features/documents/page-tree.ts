export type TreePage = {
  id: string;
  title: string;
  icon: string | null;
  parentDocumentId: string | null;
};

const byTitle = (a: TreePage, b: TreePage) =>
  a.title.localeCompare(b.title) || a.id.localeCompare(b.id);

export function childPages<T extends TreePage>(pages: T[], parentId: string) {
  return pages.filter((p) => p.parentDocumentId === parentId).sort(byTitle);
}

/**
 * The flat `/tree` list as rows in reading order, each with its depth. A page
 * whose parent you cannot open sits at the top level.
 */
export function flattenPageTree<T extends TreePage>(pages: T[]) {
  const ids = new Set(pages.map((p) => p.id));
  const children = new Map<string | null, T[]>();
  for (const p of pages) {
    const parent =
      p.parentDocumentId && ids.has(p.parentDocumentId)
        ? p.parentDocumentId
        : null;
    children.set(parent, [...(children.get(parent) ?? []), p]);
  }
  const rows: { page: T; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const p of [...(children.get(parent) ?? [])].sort(byTitle)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      rows.push({ page: p, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  // Pages in a parent loop never hang off the top; list them flat.
  for (const p of [...pages].sort(byTitle))
    if (!seen.has(p.id)) {
      seen.add(p.id);
      rows.push({ page: p, depth: 0 });
    }
  return rows;
}
