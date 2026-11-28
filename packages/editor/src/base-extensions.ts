import type { AnyExtension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentCard } from "./attachment-card";
import { dedentOrderedMarkers } from "./dedent-ordered-markers";
import { EmbedBlock } from "./embed-block";
import { KaneoDocumentLink } from "./kaneo-document-link";
import { KaneoImage } from "./kaneo-image";
import { KaneoIssueLink } from "./kaneo-issue-link";
import { SafeHardBreak } from "./safe-hard-break";

export type BaseExtensionNodes = {
  attachmentCard?: AnyExtension;
  kaneoIssueLink?: AnyExtension;
  kaneoDocumentLink?: AnyExtension;
  image?: AnyExtension;
  taskItem?: AnyExtension;
  embedBlock?: AnyExtension;
};

export type BaseExtensionsOptions = {
  placeholder: string;
  keymap?: AnyExtension[];
  decorations?: AnyExtension[];
  extra?: AnyExtension[];
  nodes?: BaseExtensionNodes;
  tableResizable?: boolean;
  /** Yjs keeps the history while co-editing, so the plain one is left out. */
  collaboration?: boolean;
};

export function createBaseExtensions({
  placeholder,
  keymap = [],
  decorations = [],
  extra = [],
  nodes = {},
  tableResizable = true,
  collaboration = false,
}: BaseExtensionsOptions): AnyExtension[] {
  const image = nodes.image ?? KaneoImage;
  const taskItem = nodes.taskItem ?? TaskItem;

  return [
    StarterKit.configure({
      codeBlock: { HTMLAttributes: { class: "kaneo-tiptap-codeblock" } },
      trailingNode: false,
      heading: { levels: [1, 2, 3] },
      hardBreak: false,
      ...(collaboration && { undoRedo: false as const }),
    }),
    SafeHardBreak,
    ...keymap,
    Markdown.extend({
      onBeforeCreate(props) {
        const { options } = this.editor;
        // The parent parses the initial content itself, before we can wrap parse.
        if (
          options.contentType === "markdown" &&
          typeof options.content === "string"
        )
          options.content = dedentOrderedMarkers(options.content);
        this.parent?.(props);
        const manager = this.editor.markdown;
        if (!manager) return;
        const parse = manager.parse.bind(manager);
        manager.parse = (markdown) => parse(dedentOrderedMarkers(markdown));
      },
    }).configure({ markedOptions: { breaks: true, gfm: true } }),
    ...decorations,
    nodes.embedBlock ?? EmbedBlock,
    nodes.attachmentCard ?? AttachmentCard,
    nodes.kaneoIssueLink ?? KaneoIssueLink,
    nodes.kaneoDocumentLink ?? KaneoDocumentLink,
    ...extra,
    TaskList,
    image.configure({
      HTMLAttributes: { class: "kaneo-editor-image", loading: "lazy" },
    }),
    taskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
    Table.configure({ resizable: tableResizable }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
