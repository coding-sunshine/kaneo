import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommentThread, { type ThreadComment } from "./comment-thread";

afterEach(cleanup);

vi.mock("./comment-card", () => ({
  default: (props: { commentId: string; isResolution: boolean }) => (
    <p>
      {props.commentId}
      {props.isResolution && " (resolution)"}
    </p>
  ),
}));

vi.mock("./reply-composer", () => ({
  default: () => <p>reply row</p>,
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
    expect(screen.getByText("reply row")).toBeVisible();
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
});
