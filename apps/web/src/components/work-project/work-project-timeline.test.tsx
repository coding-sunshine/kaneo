import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkProjectTimeline } from "./work-project-timeline";

const getWorkProjects = vi.fn();
vi.mock("@/fetchers/work-project/get-work-projects", () => ({
  default: (...a: unknown[]) => getWorkProjects(...a),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/p">{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

afterEach(cleanup);

const base = { icon: null, color: "#000", health: null, dependentIds: [] };

describe("WorkProjectTimeline", () => {
  it("marks a project that overlaps what it waits on", async () => {
    getWorkProjects.mockResolvedValue([
      {
        ...base,
        id: "x",
        name: "Launch",
        startDate: "2027-01-10T00:00:00.000Z",
        targetDate: "2027-02-01T00:00:00.000Z",
        dependsOnIds: ["y"],
      },
      {
        ...base,
        id: "y",
        name: "Build",
        startDate: "2027-01-01T00:00:00.000Z",
        targetDate: "2027-01-20T00:00:00.000Z",
        dependsOnIds: [],
      },
      {
        ...base,
        id: "z",
        name: "Someday",
        startDate: null,
        targetDate: null,
        dependsOnIds: [],
      },
    ]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkProjectTimeline workspaceId="w1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Launch")).toBeTruthy();
    const conflicts = screen.getAllByRole("img", {
      name: /workspace:workProject.timeline.conflict/,
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].getAttribute("aria-label")).toContain("Build");
    expect(screen.getByText("Someday")).toBeTruthy();
    expect(getWorkProjects).toHaveBeenCalledWith("w1", undefined);
  });
});
