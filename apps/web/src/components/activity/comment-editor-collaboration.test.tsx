import { act, cleanup, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import TaskItem from "@tiptap/extension-task-item";
import type { Editor } from "@tiptap/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import * as Y from "yjs";
import { seedFromMarkdown } from "@/components/documents/collab/seed-from-markdown";
import CommentEditor from "./comment-editor";

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  editors: [] as unknown[],
}));

vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return {
    ...actual,
    useEditor: (...args: Parameters<typeof actual.useEditor>) => {
      const editor = actual.useEditor(...args);
      if (editor && !mocks.editors.includes(editor)) mocks.editors.push(editor);
      return editor;
    },
  };
});

function inert(name: string) {
  return Extension.create({ name });
}

vi.mock("@/components/task/extensions/shiki-code-block", () => ({
  ShikiCodeBlock: inert("shikiCodeBlockStub"),
}));
vi.mock("@/components/task/extensions/mermaid-block", () => ({
  MermaidBlock: inert("mermaidBlockStub"),
}));
vi.mock("@/components/task/extensions/embed-block", () => ({
  EmbedBlock: inert("embedBlockStub"),
}));
vi.mock("@/components/task/extensions/attachment-card", () => ({
  AttachmentCard: inert("attachmentCardStub"),
}));
vi.mock("@/components/task/extensions/kaneo-issue-link", () => ({
  KaneoIssueLink: inert("kaneoIssueLinkStub"),
}));
vi.mock("@/components/task/extensions/mention-suggestion", () => ({
  MentionSuggestion: inert("mentionSuggestionStub"),
}));
vi.mock("@/components/task/extensions/task-item-with-checkbox", () => ({
  TaskItemWithCheckbox: TaskItem,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: undefined }),
  }),
);
vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock("@/lib/upload-task-image", () => ({ uploadTaskImage: vi.fn() }));
vi.mock("@/lib/shiki-highlighter", () => ({
  getSharedShikiHighlighter: () => new Promise(() => {}),
}));

const latestEditor = () => mocks.editors.at(-1) as Editor;

describe("CommentEditor while co-editing", () => {
  beforeEach(() => {
    mocks.editors.length = 0;
  });
  afterEach(cleanup);

  it("shows the shared text, and tells typing apart from others' changes", async () => {
    const shared = new Y.Doc();
    seedFromMarkdown(shared, "Shared text");
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(shared));
    const onChange = vi.fn();
    render(
      <CommentEditor
        value="Not loaded"
        onChange={onChange}
        collaboration={[Collaboration.configure({ document: shared })]}
      />,
    );
    await waitFor(() => expect(latestEditor()?.getText()).toBe("Shared text"));

    // Someone else's change, as the server passes it on.
    const paragraph = other.getXmlFragment("default").get(0) as Y.XmlElement;
    (paragraph.get(0) as Y.XmlText).insert(0, "Their ");
    act(() => Y.applyUpdate(shared, Y.encodeStateAsUpdate(other)));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("Their Shared text", {
        remote: true,
      }),
    );

    act(() => {
      latestEditor().commands.insertContentAt(1, "Mine ");
    });
    expect(onChange).toHaveBeenLastCalledWith("Mine Their Shared text", {
      remote: false,
    });
  });
});
