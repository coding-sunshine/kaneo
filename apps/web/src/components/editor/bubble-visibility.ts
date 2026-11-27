import type { Editor } from "@tiptap/core";

export function shouldShowSelectionBubble({
  editor,
  from,
  to,
}: {
  editor: Editor;
  from: number;
  to: number;
}) {
  if (editor.isActive("embedBlock")) return false;
  if (editor.isActive("image")) return false;
  if (editor.isEmpty) return false;
  return from !== to;
}

export function shouldShowTableBubble({
  editor,
  from,
  to,
}: {
  editor: Editor;
  from: number;
  to: number;
}) {
  return editor.isActive("table") && from === to;
}
