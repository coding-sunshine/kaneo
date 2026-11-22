import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { EstimateChip } from "./estimate-chip";

const scale = vi.hoisted(() => ({
  current: [] as { value: number; label: string }[],
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/project/use-estimate-options", () => ({
  useEstimateOptions: () => scale.current,
}));
vi.mock("@/components/task/task-estimate-popover", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  scale.current = [];
});

const task = (estimate: number | null) =>
  ({ id: "t", projectId: "p", estimate }) as Task;

describe("EstimateChip", () => {
  it("shows the scale label of the estimate", () => {
    scale.current = [{ value: 3, label: "M" }];
    render(<EstimateChip task={task(3)} />);
    expect(screen.getByRole("button").textContent).toBe("M");
  });

  it("hides when unestimated or the team stopped estimating", () => {
    scale.current = [{ value: 3, label: "M" }];
    const { container, rerender } = render(<EstimateChip task={task(null)} />);
    expect(container.textContent).toBe("");
    scale.current = [];
    rerender(<EstimateChip task={task(3)} />);
    expect(container.textContent).toBe("");
  });
});
