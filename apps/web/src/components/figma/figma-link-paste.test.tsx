import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import type { Editor } from "@tiptap/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import CommentEditor from "@/components/activity/comment-editor";
import { findFigmaUrls } from "./find-figma-urls";

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

function latestEditor() {
  return mocks.editors[mocks.editors.length - 1] as Editor;
}

function pasteText(editor: Editor, text: string) {
  fireEvent.paste(editor.view.dom, {
    clipboardData: {
      files: [],
      getData: (type: string) => (type === "text/plain" ? text : ""),
    },
  });
}

beforeEach(() => {
  mocks.editors.length = 0;
});

const FRAME_URL =
  "https://www.figma.com/design/AbCdEf0123456789xyzQrs/Checkout_flow_v2?type=design&node-id=12-34&mode=design&t=Ab_12";

// The card reads the markdown the comment editor saves, so the pasted link
// must survive the editor's serializer with its frame id intact.
describe("a Figma link pasted into a comment", () => {
  it.each([
    ["alone", FRAME_URL],
    ["inside a sentence", `See the payment step: ${FRAME_URL} before Friday.`],
  ])("is found once, with its frame, when pasted %s", async (_case, text) => {
    const onChange = vi.fn();
    render(<CommentEditor value="" onChange={onChange} placeholder="p" />);
    await waitFor(() => expect(latestEditor()).toBeDefined());
    await act(async () => {});

    pasteText(latestEditor(), text);

    const saved = String(onChange.mock.lastCall?.[0] ?? "");
    const found = findFigmaUrls(saved);
    expect(found).toHaveLength(1);
    const url = new URL(found[0] ?? "");
    expect(url.pathname).toBe(
      "/design/AbCdEf0123456789xyzQrs/Checkout_flow_v2",
    );
    expect(url.searchParams.get("node-id")).toBe("12-34");
  });
});
