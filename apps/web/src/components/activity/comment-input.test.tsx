import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommentInput from "./comment-input";

const { createComment, setResolved } = vi.hoisted(() => ({
  createComment: vi.fn(async () => ({ id: "reply-1" })),
  setResolved: vi.fn(async () => ({})),
}));

vi.mock("@/hooks/mutations/comment/use-create-comment", () => ({
  default: () => ({ mutateAsync: createComment, isPending: false }),
}));
vi.mock("@/hooks/mutations/comment/use-set-comment-thread-resolved", () => ({
  default: () => ({ mutateAsync: setResolved }),
}));
vi.mock("@/components/shortcuts/shortcut-keys", () => ({
  ShortcutKeys: ({ id }: { id: string }) => <kbd>{id}</kbd>,
}));
// The real editor is ProseMirror; keep only its submit-shortcut contract.
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({
    onChange,
    onSubmitResolveShortcut,
  }: {
    onChange: (value: string) => void;
    onSubmitResolveShortcut?: () => void;
  }) => (
    <textarea
      aria-label="editor"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (
          event.altKey &&
          (event.metaKey || event.ctrlKey) &&
          event.key === "Enter"
        ) {
          onSubmitResolveShortcut?.();
        }
      }}
    />
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderInput(canResolve: boolean) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CommentInput taskId="t1" parentId="c1" canResolve={canResolve} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("editor"), {
    target: { value: "done" },
  });
}

const cmdAltEnter = () =>
  fireEvent.keyDown(screen.getByLabelText("editor"), {
    key: "Enter",
    metaKey: true,
    altKey: true,
  });

describe("CommentInput", () => {
  it("cmd-alt-enter submits the reply and resolves the thread", async () => {
    renderInput(true);
    cmdAltEnter();

    await vi.waitFor(() =>
      expect(setResolved).toHaveBeenCalledWith({
        activityId: "reply-1",
        resolved: true,
      }),
    );
    expect(createComment).toHaveBeenCalledWith({
      taskId: "t1",
      comment: "done",
      parentId: "c1",
    });
  });

  it("does not resolve when the thread cannot be resolved", () => {
    renderInput(false);
    cmdAltEnter();

    expect(createComment).not.toHaveBeenCalled();
    expect(setResolved).not.toHaveBeenCalled();
  });
});
