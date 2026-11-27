import type { Editor } from "@tiptap/core";

/**
 * Runs a ProseMirror mutation without letting Tiptap's ReactRenderer call
 * `ReactDOM.flushSync` while React is inside a lifecycle method (`useEffect`
 * or `useLayoutEffect`). Tiptap checks `editor.isEditorContentInitialized` to
 * decide between `flushSync` and `queueMicrotask`; clearing it for the duration
 * of the synchronous call takes Tiptap's own microtask path instead.
 */
export function withoutFlushSync<T>(editor: Editor, run: () => T): T {
  const target = editor as Editor & { isEditorContentInitialized?: boolean };
  const wasInitialized = target.isEditorContentInitialized;
  target.isEditorContentInitialized = false;
  try {
    return run();
  } finally {
    target.isEditorContentInitialized = wasInitialized;
  }
}

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
