import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { WorkProject } from "@/fetchers/work-project/types";
import { WorkProjectRow } from "./work-project-row";

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
  vi.useRealTimers();
});

const project = (overrides: Partial<WorkProject>) =>
  ({
    id: "p",
    name: "Launch",
    icon: null,
    color: "#000",
    status: "started",
    health: null,
    priority: 0,
    leadId: null,
    targetDate: null,
    progress: { total: 4, done: 1 },
    lastUpdateAt: null,
    nextMilestone: null,
    overdueCount: 0,
    ...overrides,
  }) as WorkProject;

describe("WorkProjectRow portfolio columns", () => {
  it("shows days since the last update as plain text, the next milestone and the overdue count", () => {
    vi.useFakeTimers({ now: new Date("2027-03-20T12:00:00.000Z") });
    render(
      <WorkProjectRow
        workspaceId="w"
        lead={undefined}
        project={project({
          lastUpdateAt: "2027-03-01T09:00:00.000Z",
          nextMilestone: {
            name: "Beta",
            targetDate: "2027-04-02T00:00:00.000Z",
          },
          overdueCount: 3,
        })}
      />,
    );

    const age = screen.getByTestId("work-project-update-age");
    expect(age).toHaveTextContent(
      'workspace:workProject.updateAge {"count":19}',
    );
    expect(age.className).not.toMatch(/red|destructive|warning/);
    expect(screen.getByTestId("work-project-next-milestone")).toHaveTextContent(
      /Beta.*Apr/,
    );
    expect(screen.getByTestId("work-project-overdue")).toHaveTextContent("3");
  });

  it("leaves the update age empty when the project has no updates", () => {
    render(
      <WorkProjectRow workspaceId="w" lead={undefined} project={project({})} />,
    );
    expect(screen.getByTestId("work-project-update-age")).toBeEmptyDOMElement();
    expect(
      screen.getByTestId("work-project-next-milestone"),
    ).toBeEmptyDOMElement();
    expect(screen.getByTestId("work-project-overdue")).toHaveTextContent("0");
  });
});
