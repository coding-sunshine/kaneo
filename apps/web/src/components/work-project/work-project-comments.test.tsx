import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkProjectComments } from "./work-project-comments";

const getComments = vi.fn();
const createComment = vi.fn();
const editComment = vi.fn();
vi.mock("@/fetchers/work-project/comments", () => ({
  getWorkProjectComments: (...a: unknown[]) => getComments(...a),
  createWorkProjectComment: (...a: unknown[]) => createComment(...a),
  editWorkProjectComment: (...a: unknown[]) => editComment(...a),
  deleteWorkProjectComment: vi.fn(),
}));
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ isAdmin: false }),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderComments(editable: boolean, authorId = "me") {
  getComments.mockResolvedValue([
    {
      id: "c1",
      workProjectId: "p1",
      userId: authorId,
      userName: "Ann",
      content: "Looks good",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkProjectComments workProjectId="p1" editable={editable} />
    </QueryClientProvider>,
  );
}

describe("WorkProjectComments", () => {
  it("lists and posts a comment", async () => {
    createComment.mockResolvedValue({});
    renderComments(true);
    expect(await screen.findByText("Looks good")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Ship it " },
    });
    fireEvent.click(screen.getByText("workspace:workProject.comments.post"));
    await vi.waitFor(() =>
      expect(createComment).toHaveBeenCalledWith("p1", "Ship it"),
    );
  });

  it("hides the composer for viewers", async () => {
    renderComments(false);
    await screen.findByText("Looks good");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("lets the author edit, and no one else", async () => {
    editComment.mockResolvedValue({});
    renderComments(true);
    fireEvent.click(
      await screen.findByLabelText("workspace:workProject.comments.edit"),
    );
    fireEvent.change(screen.getAllByRole("textbox")[0] as HTMLElement, {
      target: { value: "New" },
    });
    fireEvent.click(screen.getByText("workspace:workProject.comments.save"));
    await vi.waitFor(() =>
      expect(editComment).toHaveBeenCalledWith("c1", "New"),
    );
    cleanup();
    renderComments(true, "someone-else");
    await screen.findByText("Looks good");
    expect(
      screen.queryByLabelText("workspace:workProject.comments.edit"),
    ).toBeNull();
  });
});
