import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useCreateIssueStore } from "@/store/create-issue";
import CommentActions from "./comment-actions";

const { deleteComment } = vi.hoisted(() => ({ deleteComment: vi.fn() }));
const task = {
  id: "t1",
  projectId: "p1",
  workProjectId: "wp1",
  workProjectMilestoneId: "m1",
};

afterEach(() => {
  cleanup();
  useCreateIssueStore.setState(useCreateIssueStore.getInitialState());
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
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: task }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canCreateTasks: () => true }),
}));
vi.mock("@/hooks/mutations/comment/use-set-comment-thread-subscribed", () => ({
  default: () => ({ mutate: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderActions(replyCount: number, threadSubscribed?: boolean | null) {
  render(
    <CommentActions
      commentId="c1"
      taskId="t1"
      content="hello"
      isReply={false}
      threadResolved={false}
      threadSubscribed={threadSubscribed}
      canEdit
      replyCount={replyCount}
      onEdit={vi.fn()}
    />,
  );
}

async function clickItem(name: string) {
  fireEvent.click(
    screen.getByRole("button", { name: "activity:comment.actions" }),
  );
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

const clickDelete = () => clickItem("common:actions.delete");

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

  it("new issue from comment prefills a quoted description", async () => {
    for (const [item, type] of [
      ["activity:comment.newIssueFromComment", "related"],
      ["activity:comment.newSubIssueFromComment", "parent"],
    ] as const) {
      render(
        <CommentActions
          commentId="c1"
          taskId="t1"
          content={"first line\n\nsecond line"}
          isReply={false}
          threadResolved={false}
          canEdit
          onEdit={vi.fn()}
        />,
      );
      await clickItem(item);

      expect(useCreateIssueStore.getState()).toMatchObject({
        open: true,
        draft: {
          projectId: "p1",
          description: "> first line\n>\n> second line",
          workProjectId: "wp1",
          workProjectMilestoneId: "m1",
          link: { taskId: "t1", type },
        },
      });
      cleanup();
      useCreateIssueStore.setState(useCreateIssueStore.getInitialState());
    }
  });

  it.each([
    [true, "activity:comment.unsubscribeFromThread"],
    [false, "activity:comment.subscribeToThread"],
  ])(
    "offers the thread subscription toggle (subscribed=%s)",
    async (subscribed, label) => {
      renderActions(0, subscribed);
      await clickItem(label);
    },
  );

  it("hides the subscription item when the state is unknown", async () => {
    renderActions(0, null);
    fireEvent.click(
      screen.getByRole("button", { name: "activity:comment.actions" }),
    );
    await screen.findByRole("menuitem", {
      name: "activity:comment.resolveThread",
    });
    expect(
      screen.queryByRole("menuitem", { name: /ThreadSub|subscribeToThread/i }),
    ).toBeNull();
  });
});
