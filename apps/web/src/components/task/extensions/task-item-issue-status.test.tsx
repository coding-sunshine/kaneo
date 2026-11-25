import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskItemIssueStatus } from "./task-item-issue-status";

const mocks = vi.hoisted(() => ({ getTask: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));
vi.mock("@/lib/i18n/domain", () => ({
  getStatusDisplayLabel: (status: string) => `label:${status}`,
}));
vi.mock("@/fetchers/task/get-task", () => ({ default: mocks.getTask }));

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TaskItemIssueStatus taskId="t1" />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskItemIssueStatus", () => {
  it("shows the status of the issue", async () => {
    mocks.getTask.mockResolvedValue({ id: "t1", status: "in-progress" });
    show();
    // Read out with what it is, shown as the bare status.
    const spoken = await screen.findByText(
      'navigation:documents.checklist.status {"status":"label:in-progress"}',
    );
    expect(spoken.className).toBe("sr-only");
    const shown = screen.getByText("label:in-progress");
    expect(shown.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows nothing when the issue cannot be loaded", async () => {
    mocks.getTask.mockRejectedValue(new Error("no"));
    const { container } = show();
    await vi.waitFor(() => expect(mocks.getTask).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
