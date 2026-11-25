import { render, waitFor } from "@testing-library/react";
import { type Editor, Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { describe, expect, it, vi } from "vite-plus/test";
import TaskDescription from "./task-description";

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  save: vi.fn(),
  editor: null as Editor | null,
  tasks: new Map<string, { id: string; description: string }>(),
}));

function inert(name: string) {
  return Extension.create({
    name,
    onCreate() {
      mocks.editor = this.editor;
    },
  });
}

vi.mock("./extensions/shiki-code-block", () => ({
  ShikiCodeBlock: inert("shikiCodeBlockStub"),
}));
vi.mock("./extensions/mermaid-block", () => ({
  MermaidBlock: inert("mermaidBlockStub"),
}));
vi.mock("./extensions/embed-block", () => ({
  EmbedBlock: inert("embedBlockStub"),
}));
vi.mock("./extensions/attachment-card", () => ({
  AttachmentCard: inert("attachmentCardStub"),
}));
vi.mock("./extensions/kaneo-issue-link", () => ({
  KaneoIssueLink: inert("kaneoIssueLinkStub"),
}));
vi.mock("./extensions/task-item-with-checkbox", () => ({
  TaskItemWithCheckbox: TaskItem,
}));
vi.mock("./linked-document-access-warning", () => ({
  LinkedDocumentAccessWarning: () => null,
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: (taskId: string) => ({ data: mocks.tasks.get(taskId) }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-description", () => ({
  useUpdateTaskDescription: () => ({ mutateAsync: mocks.save }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
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
// empty heading). Opening it must never write the normalized form back.
const IMPORTED =
  "## \n\n* one\n* two\n\n 1. first\n\n    ![a](/api/asset/x)\n10. tenth";

describe("TaskDescription open", () => {
  it("does not save when only the editable flag changes", async () => {
    mocks.save.mockClear();
    mocks.tasks.set("c", { id: "c", description: IMPORTED });
    const { unmount } = render(<TaskDescription taskId="c" />);
    await waitFor(() => expect(mocks.editor?.isDestroyed).toBe(false));
    await new Promise((r) => setTimeout(r, 50));
    mocks.editor!.setEditable(false);
    mocks.editor!.setEditable(true);
    await new Promise((r) => setTimeout(r, 2500));
    expect(mocks.save).not.toHaveBeenCalled();
    unmount();
  }, 10000);
});
