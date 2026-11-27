import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { DoneThisWeek } from "./done-this-week";

const { getDoneTasks } = vi.hoisted(() => ({ getDoneTasks: vi.fn() }));
vi.mock("@/fetchers/task/get-done-tasks", () => ({ default: getDoneTasks }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: PropsWithChildren) => <a href="/task">{children}</a>,
}));

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

// Wednesday; the default preference starts weeks on Sunday.
const day = new Date(2030, 0, 9).getTime();

function mount() {
  render(
    <QueryClientProvider client={client}>
      <DoneThisWeek workspaceId="workspace" day={day} />
    </QueryClientProvider>,
  );
}

it("lists the caller's completed tasks with no count or streak", async () => {
  getDoneTasks.mockResolvedValue({
    tasks: [
      {
        id: "first",
        projectId: "project",
        number: 12,
        title: "Ship the login page",
        projectName: "Web",
        projectSlug: "web",
      },
      {
        id: "second",
        projectId: "project",
        number: 13,
        title: "Fix the footer",
        projectName: "Web",
        projectSlug: "web",
      },
    ],
  });
  mount();

  const section = await screen.findByRole("region", {
    name: "workspace:home.doneThisWeek.title",
  });
  expect(await within(section).findByText("Ship the login page")).toBeVisible();
  expect(within(section).getByText("Fix the footer")).toBeVisible();
  expect(within(section).queryByRole("list")?.tagName).toBe("UL");
  expect(section.textContent).not.toMatch(/\d/);
  expect(getDoneTasks).toHaveBeenCalledWith(
    "workspace",
    new Date(2030, 0, 6).toISOString(),
  );
});

it("says so when nothing is done yet this week", async () => {
  getDoneTasks.mockResolvedValue({ tasks: [] });
  mount();
  expect(
    await screen.findByText("workspace:home.doneThisWeek.empty"),
  ).toBeVisible();
});

it("shows the load error when the list cannot load", async () => {
  getDoneTasks.mockRejectedValue(new Error("Network unavailable"));
  mount();
  expect(await screen.findByText("workspace:myWork.loadError")).toBeVisible();
});
