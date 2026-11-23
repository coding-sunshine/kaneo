import { render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { describe, expect, it, vi } from "vite-plus/test";
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

// Imported Linear text that Tiptap serializes differently (`*` bullets, an
// empty heading). Documents save through onChange, so toggling the editable
// flag must never report the normalized form as an edit.
const IMPORTED =
  "## \n\n* one\n* two\n\n 1. first\n\n    ![a](/api/asset/x)\n10. tenth";

describe("CommentEditor open", () => {
  it("does not report a change when only the editable flag changes", async () => {
    const onChange = vi.fn();
    const { rerender, unmount } = render(
      <CommentEditor value={IMPORTED} onChange={onChange} />,
    );
    await waitFor(() => expect(mocks.editors.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    rerender(<CommentEditor value={IMPORTED} onChange={onChange} disabled />);
    rerender(<CommentEditor value={IMPORTED} onChange={onChange} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });
});
