import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskDraftList } from "@/components/task-draft/task-draft-list";
import { useCreateIssueStore } from "@/store/create-issue";

let drafts: Record<string, unknown>[] = [];
const deleteDraft = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/lib/format", () => ({ formatRelativeTime: () => "just now" }));
vi.mock("@/hooks/queries/task-draft/use-task-drafts", () => ({
  useTaskDrafts: () => ({ data: drafts }),
}));
vi.mock("@/hooks/mutations/task-draft/use-delete-task-draft", () => ({
  useDeleteTaskDraft: () => ({ mutate: deleteDraft }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useCreateIssueStore.getState().setOpen(false);
});

describe("TaskDraftList", () => {
  it("shows the empty state with no drafts", () => {
    drafts = [];
    render(<TaskDraftList workspaceId="w1" />);
    expect(screen.getByText("navigation:drafts.empty")).toBeTruthy();
  });

  it("opens a draft in the create modal and deletes from the row", () => {
    drafts = [
      { id: "d1", title: "Fix login", updatedAt: new Date().toISOString() },
      { id: "d2", title: "", updatedAt: new Date().toISOString() },
    ];
    render(<TaskDraftList workspaceId="w1" />);
    expect(screen.getByText("navigation:drafts.untitled")).toBeTruthy();

    fireEvent.click(screen.getByText("Fix login"));
    expect(useCreateIssueStore.getState()).toMatchObject({
      open: true,
      savedDraft: { id: "d1" },
    });

    fireEvent.click(screen.getAllByLabelText("navigation:drafts.delete")[1]);
    expect(deleteDraft).toHaveBeenCalledWith("d2");
  });
});
