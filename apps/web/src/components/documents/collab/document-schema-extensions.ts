import { KaneoMention } from "@kaneo/editor";
import Image from "@tiptap/extension-image";
import { createEditorExtensions } from "@/components/editor/extensions";

/**
 * The document body's schema without its editing helpers, to turn Markdown
 * into the co-editing state outside the visible editor. Keep it in step with
 * the extensions `CommentEditor` builds.
 */
export const documentSchemaExtensions = () =>
  createEditorExtensions({
    placeholder: "",
    highlighter: () => null,
    resolveLanguage: (language) => language,
    image: Image,
    extra: [KaneoMention],
    collaboration: true,
  });
