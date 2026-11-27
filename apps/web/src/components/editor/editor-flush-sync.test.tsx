import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommentEditor from "@/components/activity/comment-editor";
import TaskDescription from "@/components/task/task-description";

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  editors: [] as Editor[],
  save: vi.fn(),
  tasks: new Map<string, { id: string; description: string }>(),
}));

vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return {
    ...actual,
    useEditor: (...args: Parameters<typeof actual.useEditor>) => {
      const editor = actual.useEditor(...args);
      if (editor && !mocks.editors.includes(editor)) {
        mocks.editors.push(editor);
      }
      return editor;
    },
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "ws-1" } }),
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
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: (taskId: string) => ({ data: mocks.tasks.get(taskId) }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-description", () => ({
  useUpdateTaskDescription: () => ({ mutateAsync: mocks.save }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));
vi.mock("@/components/task/linked-document-access-warning", () => ({
  LinkedDocumentAccessWarning: () => null,
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

const RICH_MARKDOWN = [
  "# Heading",
  "",
  "- [ ] First item",
  "- [x] Second item",
  "",
  "![diagram](/api/asset/img1)",
  "",
  '<kaneo-attachment url="/api/asset/file1" filename="spec.pdf" mime-type="application/pdf" size="1024" />',
].join("\n");

function captureFlushSyncWarnings() {
  const warnings: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    const text = args.map((arg) => String(arg)).join(" ");
    if (text.includes("flushSync")) {
      warnings.push(text);
    }
  });
  return { warnings, restore: () => spy.mockRestore() };
}

afterEach(() => {
  cleanup();
  mocks.editors.length = 0;
  mocks.tasks.clear();
  vi.clearAllMocks();
});

describe("Editor flushSync warnings", () => {
  it("does not log flushSync warnings when opening and typing in CommentEditor (document editor)", async () => {
    const capture = captureFlushSyncWarnings();
    try {
      const onChange = vi.fn();
      const queryClient = new QueryClient();
      const { rerender, unmount } = render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <CommentEditor value={RICH_MARKDOWN} onChange={onChange} />
          </QueryClientProvider>
        </StrictMode>,
      );

      await waitFor(() => expect(mocks.editors.length).toBeGreaterThan(0));
      const editor = mocks.editors[mocks.editors.length - 1]!;
      await waitFor(() => expect(editor.getText()).toContain("First item"));

      // Type into the editor and trigger a parent re-render.
      act(() => {
        editor.commands.insertContent(" hello");
      });
      rerender(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <CommentEditor value={RICH_MARKDOWN} onChange={onChange} />
          </QueryClientProvider>
        </StrictMode>,
      );
      // Toggle readOnly off/on and apply an external content update with React NodeViews.
      rerender(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <CommentEditor value={RICH_MARKDOWN} readOnly onChange={onChange} />
          </QueryClientProvider>
        </StrictMode>,
      );
      rerender(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <CommentEditor
              value={`${RICH_MARKDOWN}\n\n- [ ] Added item`}
              onChange={onChange}
            />
          </QueryClientProvider>
        </StrictMode>,
      );

      await waitFor(() => expect(editor.getText()).toContain("Added item"));
      unmount();

      expect(capture.warnings).toEqual([]);
    } finally {
      capture.restore();
    }
  });

  it("does not log flushSync warnings when opening, switching tasks, and typing in TaskDescription (issue editor)", async () => {
    const capture = captureFlushSyncWarnings();
    try {
      mocks.tasks.set("task-1", { id: "task-1", description: RICH_MARKDOWN });
      mocks.tasks.set("task-2", {
        id: "task-2",
        description: "- [ ] Another checklist\n\n![pic](/api/asset/img2)",
      });
      const queryClient = new QueryClient();
      const { rerender, unmount } = render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <TaskDescription taskId="task-1" />
          </QueryClientProvider>
        </StrictMode>,
      );

      await waitFor(() => expect(mocks.editors.length).toBeGreaterThan(0));
      const editor = mocks.editors[mocks.editors.length - 1]!;
      await waitFor(() => expect(editor.getText()).toContain("First item"));

      // Type in the editor.
      act(() => {
        editor.commands.insertContent(" typed");
      });

      // Switch to another issue.
      rerender(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <TaskDescription taskId="task-2" />
          </QueryClientProvider>
        </StrictMode>,
      );
      await waitFor(() =>
        expect(editor.getText()).toContain("Another checklist"),
      );
      unmount();

      expect(capture.warnings).toEqual([]);
    } finally {
      capture.restore();
    }
  });
});
