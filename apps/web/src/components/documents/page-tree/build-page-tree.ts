type PageRow = {
  id: string;
  title: string;
  icon: string | null;
  parentDocumentId: string | null;
};

export type PageNode = PageRow & { children: PageNode[] };

/** The drop target for the top of the tree. */
export const ROOT_DROP_ID = "root";

/** Nests the rows the API sends; one whose parent is missing goes on top. */
export function buildPageTree(rows: PageRow[]): PageNode[] {
  const nodes = new Map(
    rows.map((row) => [row.id, { ...row, children: [] as PageNode[] }]),
  );
  const top: PageNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentDocumentId && nodes.get(node.parentDocumentId);
    (parent ? parent.children : top).push(node);
  }
  return top;
}

/**
 * The new parent for a page dropped on a target: a page id, null for the top,
 * or undefined when the drop changes nothing or would put the page under
 * itself.
 */
export function dropParent(
  rows: PageRow[],
  activeId: string,
  overId: string,
): string | null | undefined {
  const parentOf = new Map(rows.map((row) => [row.id, row.parentDocumentId]));
  const target = overId === ROOT_DROP_ID ? null : overId;
  if (target === (parentOf.get(activeId) ?? null)) return undefined;
  for (let at = target; at; at = parentOf.get(at) ?? null) {
    if (at === activeId) return undefined;
  }
  return target;
}
