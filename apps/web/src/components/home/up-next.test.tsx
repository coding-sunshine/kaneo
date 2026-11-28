import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import { UpNext } from "./up-next";

const { getAssignedTasks } = vi.hoisted(() => ({ getAssignedTasks: vi.fn() }));
vi.mock("@/fetchers/task/get-assigned-tasks", () => ({
  default: getAssignedTasks,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: PropsWithChildren) => <a href="/my-tasks">{children}</a>,
}));
vi.mock("@/components/my-work/assigned-task-row", () => ({
  AssignedTaskRow: ({
    task,
    aside,
  }: {
    task: { title: string };
    aside?: React.ReactNode;
  }) => (
    <div data-testid="up-next-row">
      <span>{task.title}</span>
      {aside}
    </div>
  ),
}));

const open = {
  priority: "no-priority",
  dueDate: null,
  position: null,
  inCycle: false,
  blockedBy: [],
};

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

function Harness() {
  const query = useGetAssignedTasks("workspace");
  return (
    <UpNext
      tasks={query.data?.tasks}
      total={query.data?.total ?? 0}
      isLoading={query.isLoading}
      isError={query.isError}
      workspaceId="workspace"
    />
  );
}

function mount() {
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

it("keeps loaded tasks visible after a transient background refresh failure", async () => {
  getAssignedTasks.mockResolvedValue({
    tasks: [{ ...open, id: "task", title: "Still here" }],
    total: 1,
  });
  mount();
  expect(await screen.findByText("Still here")).toBeVisible();
  getAssignedTasks.mockRejectedValue(new Error("Network unavailable"));
  await act(async () => {
    await client.refetchQueries({ queryKey: ["assigned-tasks", "workspace"] });
  });
  expect(screen.getByText("Still here")).toBeVisible();
  expect(
    screen.queryByText("workspace:myWork.loadError"),
  ).not.toBeInTheDocument();
});

it("shows the load error when no tasks have been loaded", async () => {
  getAssignedTasks.mockRejectedValue(new Error("Network unavailable"));
  mount();
  expect(await screen.findByText("workspace:myWork.loadError")).toBeVisible();
});

it("orders rows by cycle, priority and blockers and prints each row's reason", async () => {
  getAssignedTasks.mockResolvedValue({
    tasks: [
      {
        ...open,
        id: "a",
        title: "Overdue low",
        priority: "low",
        dueDate: "2020-01-01T00:00:00Z",
      },
      {
        ...open,
        id: "b",
        title: "Blocked urgent",
        priority: "urgent",
        blockedBy: ["web-6", null],
      },
      { ...open, id: "c", title: "Urgent", priority: "urgent" },
      { ...open, id: "d", title: "In cycle", inCycle: true },
    ],
    total: 4,
  });
  mount();
  await screen.findByText("In cycle");
  const rows = screen.getAllByTestId("up-next-row");
  expect(rows.map((row) => row.firstChild?.textContent)).toEqual([
    "In cycle",
    "Urgent",
    "Overdue low",
    "Blocked urgent",
  ]);
  expect(rows[0]).toHaveTextContent("workspace:home.upNext.reasons.cycle");
  expect(rows[1]).toHaveTextContent("workspace:home.upNext.reasons.priority");
  expect(rows[3]).toHaveTextContent("workspace:home.upNext.reasons.blocked");
  expect(rows[3]).toHaveTextContent("web-6");
  expect(rows[3]).toHaveTextContent(
    "workspace:home.upNext.reasons.hiddenBlockers",
  );
  for (const row of rows)
    expect(row.querySelector("[data-up-next-reason]")).not.toBeNull();
});
