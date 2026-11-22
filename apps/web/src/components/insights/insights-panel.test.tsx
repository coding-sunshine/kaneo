import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { groupProjectBy } from "@/lib/group-project";
import type {
  GroupFn,
  InsightPoint,
  InsightSlice,
  Insights,
} from "@/lib/insights/compute-insights";
import { useInsightsSelectionStore } from "@/store/insights-selection";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { InsightsBarChart } from "./insights-bar-chart";
import { InsightsBurnUp } from "./insights-burn-up";
import { InsightsPanel } from "./insights-panel";
import { InsightsScatter } from "./insights-scatter";
import { InsightsTable } from "./insights-table";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count === undefined ? key : `${key}:${opts.count}`,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ workspaceId: "w" }),
  Link: ({ children, ...rest }: { children?: ReactNode }) => (
    <a href="/x" {...(rest as object)}>
      {children}
    </a>
  ),
}));

const teams = vi.hoisted(() => ({
  current: [] as { id: string; estimateType: string }[],
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w" } }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: teams.current }),
}));

afterEach(() => {
  teams.current = [];
  cleanup();
  useInsightsSelectionStore.getState().setIds(null);
});

const task = (id: string, status: string): Task =>
  ({
    id,
    title: id,
    number: 1,
    projectId: "p",
    status,
    createdAt: "2026-11-01T00:00:00Z",
  }) as Task;

const project = {
  slug: "ENG",
  columns: [
    {
      id: "todo",
      name: "Todo",
      slug: "todo",
      icon: "Circle",
      tasks: [task("a", "todo"), task("b", "todo")],
    },
    {
      id: "done",
      name: "Done",
      slug: "done",
      icon: "Circle",
      tasks: [task("c", "done")],
    },
  ],
} as unknown as ProjectWithTasks;
const group: GroupFn = (p, by) => groupProjectBy(p, by, (key) => key);

const point = (id: string, days: number, segments: number[]): InsightPoint => ({
  task: task(id, "todo"),
  days,
  segment: segments[0],
  segments,
});
const slice = (
  key: string,
  counts: number[],
  points: InsightPoint[],
): InsightSlice => ({
  key,
  name: key,
  counts,
  value: counts.reduce((a, b) => a + b, 0),
  points,
  medianDays: 2,
  percentiles: [
    { percent: 25, days: 1 },
    { percent: 50, days: 2 },
    { percent: 75, days: 3 },
    { percent: 95, days: 9 },
  ],
});
const insights = {
  segments: [
    { key: "s0", name: "Bug" },
    { key: "s1", name: "UI" },
  ],
  slices: [
    slice("todo", [1, 1], [point("a", 1, [0]), point("b", 2, [1])]),
    slice("done", [0, 1], [point("c", 3, [1])]),
  ],
  issueCount: 3,
  maxValue: 2,
  maxDays: 3,
  percentiles: [],
} as Insights;

const ids = () => [...(useInsightsSelectionStore.getState().ids ?? [])];

describe("InsightsPanel selection", () => {
  it("filters the view to a clicked bar, then clears on a second click", () => {
    render(<InsightsPanel project={project} group={group} />);
    const bar = screen.getByRole("button", { name: "Todo: 2" });
    fireEvent.click(bar);
    expect(ids()).toEqual(["a", "b"]);
    fireEvent.click(bar);
    expect(useInsightsSelectionStore.getState().ids).toBeNull();
  });

  it("clears on Escape", () => {
    render(<InsightsPanel project={project} group={group} />);
    fireEvent.click(screen.getByRole("button", { name: "Done: 1" }));
    expect(ids()).toEqual(["c"]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useInsightsSelectionStore.getState().ids).toBeNull();
  });

  it("clears the filter when the panel closes", () => {
    const { unmount } = render(
      <InsightsPanel project={project} group={group} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Done: 1" }));
    unmount();
    expect(useInsightsSelectionStore.getState().ids).toBeNull();
  });

  it("selects from a table row", () => {
    render(<InsightsPanel project={project} group={group} />);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(ids()).toEqual(["c"]);
  });

  it("lights the table row of a hovered bar", () => {
    render(<InsightsPanel project={project} group={group} />);
    const row = screen.getByRole("button", { name: "Todo" }).closest("tr");
    expect(row?.className).not.toContain("bg-accent");
    fireEvent.mouseEnter(screen.getByRole("group", { name: "Todo: 2" }));
    expect(row?.className).toContain("bg-accent");
  });
});

describe("InsightsTable", () => {
  it("selects a segment column and a cell", () => {
    const onSelect = vi.fn();
    render(
      <InsightsTable
        insights={insights}
        measure="count"
        sliceLabel="Status"
        segmented
        selection={null}
        hovered={null}
        onHover={vi.fn()}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "UI" }));
    expect(onSelect).toHaveBeenLastCalledWith({ segment: 1 });
    fireEvent.click(screen.getAllByRole("button", { name: "1" })[0]);
    expect(onSelect).toHaveBeenLastCalledWith({ slice: "todo", segment: 0 });
  });
});

describe("InsightsScatter", () => {
  it("reports the slice of a hovered point", () => {
    const onHover = vi.fn();
    render(
      <InsightsScatter
        insights={insights}
        slug="ENG"
        segmented
        hovered={null}
        onHover={onHover}
      />,
    );
    fireEvent.mouseEnter(screen.getByLabelText("ENG-1 c"));
    expect(onHover).toHaveBeenCalledWith("done");
  });
});

describe("InsightsBarChart", () => {
  it("shows the slice data and percentile breakdown on hover", () => {
    render(
      <InsightsBarChart
        insights={insights}
        segmented
        selection={null}
        hovered={null}
        onHover={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const [tip] = screen.getAllByRole("tooltip", { hidden: true });
    expect(tip.textContent).toContain("todo");
    expect(tip.textContent).toContain("95%");
    expect(tip.textContent).toContain("tasks:insights.days:9");
  });
});

describe("InsightsBurnUp", () => {
  it("lists a row per period, newest first", () => {
    render(
      <InsightsBurnUp
        interval="month"
        buckets={[
          {
            key: "2026-10-01",
            start: Date.UTC(2026, 9, 1),
            created: 1,
            started: 0,
            completed: 0,
          },
          {
            key: "2026-11-01",
            start: Date.UTC(2026, 10, 1),
            created: 3,
            started: 2,
            completed: 1,
          },
        ]}
      />,
    );
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Nov");
    expect(rows[1].textContent).toContain("3");
    expect(rows[2].textContent).toContain("Oct");
  });
});
