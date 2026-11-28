import { createBaseExtensions } from "@kaneo/editor";
import type { AnyExtension } from "@tiptap/core";
import type { Highlighter } from "shiki";
import { AttachmentCard } from "@/components/task/extensions/attachment-card";
import { EmbedBlock } from "@/components/task/extensions/embed-block";
import { KaneoDocumentLink } from "@/components/task/extensions/kaneo-document-link";
import { KaneoIssueLink } from "@/components/task/extensions/kaneo-issue-link";
import { MermaidBlock } from "@/components/task/extensions/mermaid-block";
import { ShikiCodeBlock } from "@/components/task/extensions/shiki-code-block";
import { TaskItemWithCheckbox } from "@/components/task/extensions/task-item-with-checkbox";
import { EditorKeymap } from "./editor-keymap";
import { detectCodeLanguage } from "./detect-code-language";

export function createEditorExtensions({
  placeholder,
  highlighter,
  resolveLanguage,
  image,
  extra = [],
  mermaidErrorKey,
  collaboration,
}: {
  placeholder: string;
  highlighter: () => Highlighter | null;
  resolveLanguage: (language: string) => string;
  image: AnyExtension;
  extra?: AnyExtension[];
  mermaidErrorKey?: string;
  collaboration?: boolean;
}) {
  return createBaseExtensions({
    placeholder,
    collaboration,
    keymap: [EditorKeymap],
    decorations: [
      ShikiCodeBlock.configure({
        highlighter,
        resolveLanguage,
        detectLanguage: detectCodeLanguage,
        themeDark: "github-dark",
        themeLight: "github-light",
      }),
      mermaidErrorKey
        ? MermaidBlock.configure({ errorKey: mermaidErrorKey })
        : MermaidBlock,
    ],
    extra,
    nodes: {
      embedBlock: EmbedBlock,
      attachmentCard: AttachmentCard,
      kaneoIssueLink: KaneoIssueLink,
      kaneoDocumentLink: KaneoDocumentLink,
      image,
      taskItem: TaskItemWithCheckbox,
    },
  });
}
