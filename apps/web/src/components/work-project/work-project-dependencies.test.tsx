import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkProjectDependencies } from "./work-project-dependencies";

vi.mock("@/fetchers/work-project/get-work-projects", () => ({
  default: () =>
    Promise.resolve([
      { id: "x", name: "Launch", icon: null, color: "#000" },
      { id: "y", name: "Build", icon: null, color: "#000" },
      { id: "z", name: "Docs", icon: null, color: "#000" },
      { id: "v", name: "Sales", icon: null, color: "#000" },
    ]),
}));
const removeDependency = vi.fn();
vi.mock("@/fetchers/work-project/dependencies", () => ({
  addWorkProjectDependency: vi.fn(),
  removeWorkProjectDependency: (...a: unknown[]) => removeDependency(...a),
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderSection = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkProjectDependencies
        workspaceId="w1"
        project={{ id: "x", dependsOnIds: ["y"], dependentIds: ["v"] }}
        editable
      />
    </QueryClientProvider>,
  );

describe("WorkProjectDependencies", () => {
  it("shows what the project waits on and what waits on it", async () => {
    renderSection();
    expect(await screen.findByText("Build")).toBeTruthy();
    expect(screen.getByText("Sales")).toBeTruthy();
    expect(screen.queryByText("Docs")).toBeNull();
  });

  it("removes a link from either side", async () => {
    removeDependency.mockResolvedValue({});
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", {
        name: 'workspace:workProject.dependencies.remove {"name":"Build"}',
      }),
    );
    await waitFor(() =>
      expect(removeDependency).toHaveBeenCalledWith("x", "y"),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: 'workspace:workProject.dependencies.remove {"name":"Sales"}',
      }),
    );
    await waitFor(() =>
      expect(removeDependency).toHaveBeenCalledWith("v", "x"),
    );
  });
});
