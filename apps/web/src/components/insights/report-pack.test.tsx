import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  daysAgo,
  NOW,
  reportProject,
  reportTask,
} from "@/lib/insights/report-fixture";
import { ReportPack } from "./report-pack";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
    i18n: { language: "en-US" },
  }),
}));

afterEach(cleanup);

const project = reportProject({
  "in-progress": [
    reportTask("Fresh work", {
      startedAt: daysAgo(1),
      assigneeName: "person-1",
    }),
    reportTask("Stale work", {
      startedAt: daysAgo(9),
      assigneeName: "person-1",
    }),
  ],
  "in-review": [reportTask("Waiting", { statusSince: daysAgo(3) })],
  done: [
    reportTask("Shipped", {
      startedAt: daysAgo(6),
      completedAt: daysAgo(2),
      assigneeName: "person-2",
    }),
  ],
});

describe("ReportPack", () => {
  it("lists aging work, charts weekly throughput with a rolling median, and shows review wait", () => {
    render(<ReportPack project={project} now={NOW} />);

    const aging = screen.getByRole("table", {
      name: "tasks:insights.report.aging.title",
    });
    expect(within(aging).getByText("Stale work")).toBeInTheDocument();
    expect(within(aging).queryByText("Fresh work")).not.toBeInTheDocument();

    const chart = screen.getByRole("img", {
      name: "tasks:insights.report.throughput.title",
    });
    expect(chart.querySelectorAll("[data-throughput-week]")).toHaveLength(12);
    expect(chart.querySelector("[data-rolling-median]")).not.toBeNull();

    expect(
      screen.getByText(/tasks:insights\.report\.reviewWait\.summary/),
    ).toHaveTextContent('"count":1');
  });

  it("never groups by person", () => {
    const { container } = render(<ReportPack project={project} now={NOW} />);
    expect(container.textContent).not.toMatch(/person-|assignee/i);
  });
});
