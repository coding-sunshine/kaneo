import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { StatusTimeList } from "./status-time-list";

const query = vi.hoisted(() => ({
  current: {} as { data?: unknown; isLoading?: boolean; isError?: boolean },
}));
vi.mock("@/hooks/queries/task/use-task-status-spans", () => ({
  useTaskStatusSpans: () => query.current,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

afterEach(cleanup);

const MINUTE = 60_000;

describe("StatusTimeList", () => {
  it("lists cumulative time per status, marking the current one", () => {
    query.current = {
      data: {
        spans: [
          {
            status: "to-do",
            name: "To Do",
            totalMs: 3 * MINUTE,
            current: false,
          },
          {
            status: "old-slug",
            name: null,
            totalMs: 50 * 60 * MINUTE,
            current: false,
          },
          {
            status: "in-review",
            name: "In Review",
            totalMs: 3 * 24 * 60 * MINUTE,
            current: true,
          },
        ],
      },
    };
    render(<StatusTimeList taskId="task-1" />);

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "To Do3m",
      "old-slug2d",
      "In Reviewtasks:statusTime.current3d",
    ]);
  });

  it("shows loading and error states", () => {
    query.current = { isLoading: true };
    const { rerender } = render(<StatusTimeList taskId="task-1" />);
    expect(screen.getByText("common:empty.loading")).toBeInTheDocument();

    query.current = { isError: true };
    rerender(<StatusTimeList taskId="task-1" />);
    expect(screen.getByText("tasks:statusTime.error")).toBeInTheDocument();
  });
});
