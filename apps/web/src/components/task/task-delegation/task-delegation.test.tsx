import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskDelegation } from "./task-delegation";

const m = vi.hoisted(() => ({
  agent: { configured: true, name: "Test agent" } as {
    configured: boolean;
    name: string | null;
  },
  mutate: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => true,
}));
vi.mock("@/hooks/queries/agent/use-coding-agent", () => ({
  useCodingAgent: () => ({ data: m.agent }),
}));
vi.mock("@/hooks/queries/agent/use-task-delegations", () => ({
  useTaskDelegations: () => ({
    data: [
      {
        id: "r1",
        taskId: "t1",
        agent: "Test agent",
        status: "pr_opened",
        pullRequestUrl: "https://git.example.test/pull/7",
        error: null,
        createdAt: "2026-11-28T00:00:00.000Z",
      },
    ],
  }),
}));
vi.mock("@/hooks/mutations/agent/use-delegate-task", () => ({
  useDelegateTask: () => ({ mutate: m.mutate, isPending: false }),
}));

afterEach(() => {
  cleanup();
  m.mutate.mockReset();
});

describe("TaskDelegation", () => {
  it("proposes the handover and lists the run with its pull request", () => {
    m.agent = { configured: true, name: "Test agent" };
    render(<TaskDelegation workspaceId="w1" taskId="t1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:delegation.action" }),
    );
    expect(m.mutate).toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "tasks:delegation.pullRequest" }),
    ).toHaveProperty("href", "https://git.example.test/pull/7");
  });

  it("says no coding agent is set up instead of offering the button", () => {
    m.agent = { configured: false, name: null };
    render(<TaskDelegation workspaceId="w1" taskId="t1" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("tasks:delegation.notConfigured")).toBeTruthy();
  });
});
