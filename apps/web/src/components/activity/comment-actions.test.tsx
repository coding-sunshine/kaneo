import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommentActions from "./comment-actions";

const { deleteComment } = vi.hoisted(() => ({ deleteComment: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("./add-reaction-button", () => ({ default: () => null }));
vi.mock("@/hooks/mutations/comment/use-delete-comment", () => ({
  default: () => ({ mutate: deleteComment }),
}));
vi.mock("@/hooks/mutations/comment/use-set-comment-reaction", () => ({
  default: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/mutations/comment/use-set-comment-thread-resolved", () => ({
  default: () => ({ mutate: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderActions(replyCount: number) {
  render(
    <CommentActions
      commentId="c1"
      taskId="t1"
      content="hello"
      isReply={false}
      threadResolved={false}
      canEdit
      replyCount={replyCount}
      onEdit={vi.fn()}
    />,
  );
}

async function clickDelete() {
  fireEvent.click(
    screen.getByRole("button", { name: "activity:comment.actions" }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "common:actions.delete" }),
  );
}

describe("CommentActions", () => {
  it("asks before deleting a comment", async () => {
    renderActions(2);
    await clickDelete();

    expect(
      await screen.findByText("activity:comment.deleteTitle"),
    ).toBeVisible();
    expect(
      screen.getByText("activity:comment.deleteRepliesNote"),
    ).toBeVisible();
    expect(screen.getByText("activity:comment.deleteUndoNote")).toBeVisible();
    expect(deleteComment).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.delete" }),
    );
    expect(deleteComment).toHaveBeenCalledWith({ activityId: "c1" });
  });

  it("leaves the replies line out when the comment has no replies", async () => {
    renderActions(0);
    await clickDelete();

    expect(
      await screen.findByText("activity:comment.deleteUndoNote"),
    ).toBeVisible();
    expect(
      screen.queryByText("activity:comment.deleteRepliesNote"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.cancel" }),
    );
    expect(deleteComment).not.toHaveBeenCalled();
  });
});
