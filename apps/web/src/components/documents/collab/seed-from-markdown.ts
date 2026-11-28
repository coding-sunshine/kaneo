import { Editor } from "@tiptap/core";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import type * as Y from "yjs";
import { normalizeCommentMarkdown } from "@/lib/normalize-comment-markdown";
import { documentSchemaExtensions } from "./document-schema-extensions";

/** Writes the Markdown into the doc's "default" fragment, where the editor reads. */
export function seedFromMarkdown(doc: Y.Doc, markdown: string) {
  const editor = new Editor({
    extensions: documentSchemaExtensions(),
    content: normalizeCommentMarkdown(markdown),
    contentType: "markdown",
  });
  try {
    prosemirrorJSONToYXmlFragment(
      editor.schema,
      editor.getJSON(),
      doc.getXmlFragment("default"),
    );
  } finally {
    editor.destroy();
  }
}
