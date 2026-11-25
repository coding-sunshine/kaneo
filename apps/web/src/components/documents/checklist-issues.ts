import type { Editor } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { parseTaskRouteFromUrl } from "@/components/task/extensions/parse-task-route";

export type ChecklistLine = { pos: number; title: string };
export type IssueLink = ChecklistLine & { key: string; url: string };

const firstParagraph = (item: ProseNode) => item.firstChild;

/** The id of the issue a checklist line links to, or null. */
export function issueIdInLine(item: ProseNode): string | null {
  let id: string | null = null;
  firstParagraph(item)?.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type.name !== "link") continue;
      id ??= parseTaskRouteFromUrl(String(mark.attrs.href))?.taskId ?? null;
    }
  });
  return id;
}

/** Open lines without an issue in the checklist around the selection. */
export function checklistLines(editor: Editor): ChecklistLine[] {
  const { $from } = editor.state.selection;
  let depth = 0;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "taskList") depth = d;
  }
  if (!depth) return [];
  const start = $from.start(depth);
  const lines: ChecklistLine[] = [];
  $from.node(depth).descendants((node, pos) => {
    if (node.type.name !== "taskItem" || node.attrs.checked) return;
    const title = firstParagraph(node)?.textContent.trim();
    if (title && !issueIdInLine(node)) lines.push({ pos: start + pos, title });
  });
  return lines;
}

/** Ends each line with its issue key as a link, in one change. */
export function addIssueLinks(editor: Editor, links: IssueLink[]) {
  const { tr, schema } = editor.state;
  for (const link of [...links].sort((a, b) => b.pos - a.pos)) {
    const item = tr.doc.nodeAt(link.pos);
    if (item?.type.name !== "taskItem") continue;
    const paragraph = firstParagraph(item);
    if (paragraph?.textContent.trim() !== link.title) continue;
    tr.insert(link.pos + paragraph.nodeSize, [
      schema.text(" "),
      schema.text(link.key, [schema.marks.link.create({ href: link.url })]),
    ]);
  }
  editor.view.dispatch(tr);
}
