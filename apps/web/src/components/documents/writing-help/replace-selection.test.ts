import { createBaseExtensions } from "@kaneo/editor";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { replaceSelection, selectedText } from "./replace-selection";

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

const paragraph = (from: Editor) => {
  let range = { from: 0, to: 0 };
  from.state.doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent.startsWith("We met")) {
      range = { from: pos + 1, to: pos + 1 + node.content.size };
    }
  });
  return range;
};

describe("replaceSelection", () => {
  it("replaces the selected paragraph, and one undo restores it", () => {
    editor = new Editor({
      extensions: createBaseExtensions({ placeholder: "" }),
      content:
        "<p>Intro stays.</p><p>We met on Tuesday and, after a long talk, agreed to move the launch.</p><p>Outro stays.</p>",
    });
    const range = paragraph(editor);
    const original = selectedText(editor, range);
    expect(original).toContain("We met on Tuesday");

    replaceSelection(editor, range, "The launch moves.");
    expect(editor.getText()).toContain("Intro stays.");
    expect(editor.getText()).toContain("The launch moves.");
    expect(editor.getText()).not.toContain("We met on Tuesday");
    expect(editor.getText()).toContain("Outro stays.");

    editor.commands.undo();
    expect(editor.getText()).toContain(original);
    expect(editor.getText()).not.toContain("The launch moves.");
  });
});
