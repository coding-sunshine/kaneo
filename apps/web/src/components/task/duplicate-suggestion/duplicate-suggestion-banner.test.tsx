import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DuplicateSuggestionBanner } from "./duplicate-suggestion-banner";

const suggestionsHook = vi.fn();
const accept = vi.fn();
const decline = vi.fn();
let canUpdate = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => canUpdate }),
}));
vi.mock(
  "@/hooks/queries/duplicate-suggestion/use-duplicate-suggestions",
  () => ({
    default: (...args: unknown[]) => suggestionsHook(...args),
  }),
);
vi.mock("@/hooks/mutations/task-relation/use-create-task-relation", () => ({
  default: () => ({ mutate: accept, isPending: false }),
}));
vi.mock(
  "@/hooks/mutations/duplicate-suggestion/use-decline-duplicate-suggestion",
  () => ({ default: () => ({ mutate: decline, isPending: false }) }),
);

const suggestion = {
  id: "t2",
  title: "Login page crashes on Safari",
  ticket: "WEB-2",
  projectId: "p1",
  status: "to-do",
  similarity: 0.8,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  canUpdate = true;
});

describe("DuplicateSuggestionBanner", () => {
  it("lists the suggestion; accept proposes a duplicate relation", () => {
    suggestionsHook.mockReturnValue({ data: { suggestions: [suggestion] } });
    render(<DuplicateSuggestionBanner taskId="t1" workspaceId="ws1" />);
    expect(screen.getByText("Login page crashes on Safari")).toBeTruthy();
    fireEvent.click(screen.getByText("tasks:duplicateSuggestion.accept"));
    expect(accept).toHaveBeenCalledWith(
      { sourceTaskId: "t1", targetTaskId: "t2", relationType: "duplicate" },
      expect.anything(),
    );
    expect(decline).not.toHaveBeenCalled();
  });

  it("decline hides that pair", () => {
    suggestionsHook.mockReturnValue({ data: { suggestions: [suggestion] } });
    render(<DuplicateSuggestionBanner taskId="t1" workspaceId="ws1" />);
    fireEvent.click(screen.getByText("tasks:duplicateSuggestion.decline"));
    expect(decline).toHaveBeenCalledWith(
      { taskId: "t1", otherTaskId: "t2" },
      expect.anything(),
    );
  });

  it("shows nothing without suggestions, and no buttons without task:update", () => {
    suggestionsHook.mockReturnValue({ data: { suggestions: [] } });
    const { container } = render(
      <DuplicateSuggestionBanner taskId="t1" workspaceId="ws1" />,
    );
    expect(container.innerHTML).toBe("");
    cleanup();
    canUpdate = false;
    suggestionsHook.mockReturnValue({ data: { suggestions: [suggestion] } });
    render(<DuplicateSuggestionBanner taskId="t1" workspaceId="ws1" />);
    expect(screen.queryByText("tasks:duplicateSuggestion.accept")).toBeNull();
  });
});
