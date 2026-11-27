import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { AssignedTaskRow } from "./assigned-task-row";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/lib/format", () => ({ formatDateMedium: (d: string) => d }));

afterEach(cleanup);

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const task = {
  id: "t1",
  projectId: "p1",
  number: 1,
  title: "Checkout redesign",
  status: "to-do",
  statusName: "To do",
  statusIcon: null,
  priority: "medium",
  dueDate: null,
  lastActivityAt: null,
  lastActivityType: null,
  reviewRequestedAt: hoursAgo(50),
  reviewSlaDueAt: hoursAgo(2),
  workProjectId: null,
  workProjectMilestoneId: null,
  projectName: "Web",
  projectSlug: "WEB",
  projectIcon: null,
  labels: [],
} satisfies AssignedTask;

describe("AssignedTaskRow", () => {
  it("shows how long a design review has waited and its SLA state", () => {
    render(<AssignedTaskRow task={task} workspaceId="w1" showReview />);
    expect(screen.getByText("2d")).toBeTruthy();
    expect(screen.getByText("tasks:sla.breached")).toBeTruthy();
  });
});
