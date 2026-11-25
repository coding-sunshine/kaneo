import { mergeAttributes, Node } from "@tiptap/core";
import { escapeHtml } from "./url-safety";

/**
 * A link to a document, pasted into an issue's description or a comment. It
 * keeps only the address: the title and the status are read when it is shown,
 * so the link never says more than the reader may see.
 */
export const KaneoDocumentLink = Node.create({
  name: "kaneoDocumentLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return { url: { default: "" } };
  },

  parseHTML() {
    return [{ tag: "kaneo-document-link[url]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["kaneo-document-link", mergeAttributes(HTMLAttributes)];
  },

  renderMarkdown(node: { attrs?: { url?: string } }) {
    const url = String(node.attrs?.url || "");
    return url ? `\n<kaneo-document-link url="${escapeHtml(url)}" />\n` : "";
  },
});
