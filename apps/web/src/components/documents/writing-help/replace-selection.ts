import type { Editor } from "@tiptap/core";

export type TextRange = { from: number; to: number };

/**
 * Puts `text` where the selection was, in one transaction, so a single undo
 * brings the original back. Blank lines in the text become paragraphs.
 */
export function replaceSelection(
  editor: Editor,
  range: TextRange,
  text: string,
) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const content =
    paragraphs.length > 1
      ? paragraphs.map((paragraph) => ({
          type: "paragraph",
          content: [{ type: "text", text: paragraph }],
        }))
      : { type: "text", text: paragraphs[0] ?? "" };
  return editor.chain().focus().insertContentAt(range, content).run();
}

/** The selected text, read the way the model is sent it. */
export const selectedText = (editor: Editor, range: TextRange) =>
  editor.state.doc.textBetween(range.from, range.to, "\n\n");
