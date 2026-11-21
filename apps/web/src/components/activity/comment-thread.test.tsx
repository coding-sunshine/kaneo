import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import CommentThread, { type ThreadComment } from "./comment-thread";

afterEach(cleanup);

vi.mock("./comment-card", () => ({
  default: (props: { commentId: string; isResolution: boolean }) => (
    <div>
      <p>
        {props.commentId}
        {props.isResolution && " (resolution)"}
      </p>
      {props.commentId === "root" && <textarea aria-label="typing" />}
    </div>
  ),
}));

vi.mock("./reply-composer", () => ({
  default: ({ focusRequest }: { focusRequest?: number }) => (
    <p>reply row {focusRequest}</p>
  ),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));

vi.mock("@/hooks/queries/workspace-users/use-get-workspace-users", () => ({
  default: () => ({ data: [] }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? ` ${Object.values(values).join(" ")}` : ""}`,
  }),
}));

const comment = (id: string, extra: Partial<ThreadComment> = {}) => ({
  id,
  taskId: "t1",
  content: id,
  createdAt: "2026-11-14T16:38:46.191Z",
  userId: null,
  externalSource: "linear",
  externalUserName: id === "r1" ? "Hardik" : "Azhar",
  ...extra,
});

describe("CommentThread", () => {
  it("ends an open thread with its replies and a reply row", () => {
    render(
      <CommentThread
        root={comment("root")}
        replies={[comment("r1"), comment("r2")]}
      />,
    );
    expect(screen.getByText("root")).toBeVisible();
    expect(screen.getByText("r1")).toBeVisible();
    expect(screen.getByText("r2")).toBeVisible();
    expect(screen.getByText(/reply row/)).toBeVisible();
  });

  it("folds a resolved thread down to its resolution", () => {
    render(
      <CommentThread
        root={comment("root", {
          resolvedAt: "2026-11-14T17:17:40.570Z",
          resolvingCommentId: "r2",
        })}
        replies={[comment("r1"), comment("r2")]}
      />,
    );
    expect(screen.queryByText("r1")).not.toBeInTheDocument();
    expect(screen.getByText("r2 (resolution)")).toBeVisible();
    expect(screen.queryByText("reply row")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /activity:comment\.foldedReplies 1 Hardik/,
      }),
    );
    expect(screen.getByText("r1")).toBeVisible();
  });

  it("folds every reply when resolved from the root", () => {
    render(
      <CommentThread
        root={comment("root", {
          id: "root-resolved",
          resolvedAt: "2026-11-14T17:17:40.570Z",
          resolvingCommentId: null,
        })}
        replies={[comment("r1"), comment("r2")]}
      />,
    );
    expect(screen.queryByText("r1")).not.toBeInTheDocument();
    expect(screen.queryByText("r2")).not.toBeInTheDocument();
    expect(screen.queryByText(/reply row/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /activity:comment\.foldedReplies 2/,
      }),
    );
    expect(screen.getByText("r1")).toBeVisible();
    expect(screen.getByText("r2")).toBeVisible();
  });

  const longThread = () =>
    Array.from({ length: 7 }, (_, index) =>
      comment(`r${index + 1}`, {
        createdAt: `2026-11-14T16:4${index}:00.000Z`,
      }),
    );

  it("collapses a long thread to its last 4 replies", () => {
    render(
      <CommentThread
        root={comment("root", { id: "root-long" })}
        replies={longThread()}
      />,
    );
    for (const id of ["r1", "r2", "r3"])
      expect(screen.queryByText(id)).not.toBeInTheDocument();
    for (const id of ["r4", "r5", "r6", "r7"])
      expect(screen.getByText(id)).toBeVisible();

    // Most frequent author first: Azhar wrote r2 and r3, Hardik r1.
    fireEvent.click(
      screen.getByRole("button", {
        name: /activity:comment\.foldedReplies 3 Azhar and Hardik/,
      }),
    );
    expect(screen.getByText("r1")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "activity:comment.collapseThread" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "activity:comment.collapseThread" }),
    );
    expect(screen.queryByText("r1")).not.toBeInTheDocument();
  });

  it("keeps a thread of 5 replies open", () => {
    render(
      <CommentThread
        root={comment("root", { id: "root5" })}
        replies={longThread().slice(0, 5)}
      />,
    );
    expect(screen.getByText("r1")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens a long thread at a linked reply", () => {
    window.history.replaceState(null, "", "#comment-r2");
    render(
      <CommentThread
        root={comment("root", { id: "root-linked" })}
        replies={longThread()}
      />,
    );
    window.history.replaceState(null, "", "/");
    expect(screen.getByText("r2")).toBeVisible();
  });

  it("replies with r on a focused comment", () => {
    render(
      <ShortcutTestWrapper>
        <CommentThread root={comment("root")} replies={[comment("r1")]} />
      </ShortcutTestWrapper>,
    );
    const typing = screen.getByLabelText("typing");
    fireEvent.focus(typing);

    // Typing an "r" into an editor must not trigger the shortcut.
    fireEvent.keyDown(typing, { key: "r" });
    expect(screen.getByText(/reply row/)).toHaveTextContent(/^reply row 0$/);

    fireEvent.keyDown(screen.getByText("r1"), { key: "r" });
    expect(screen.getByText(/reply row/)).toHaveTextContent(/^reply row 1$/);
  });

  it("ignores r when no comment is hovered or focused", () => {
    render(
      <ShortcutTestWrapper>
        <CommentThread root={comment("root")} replies={[]} />
      </ShortcutTestWrapper>,
    );
    fireEvent.keyDown(document.body, { key: "r" });
    expect(screen.getByText(/reply row/)).toHaveTextContent(/^reply row 0$/);
  });
});
