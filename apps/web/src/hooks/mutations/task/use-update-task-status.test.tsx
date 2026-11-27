import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { useUpdateTaskStatus } from "./use-update-task-status";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  celebrate: vi.fn(),
}));

vi.mock("@/fetchers/task/update-task-status", () => ({
  default: mocks.update,
}));
vi.mock("@/lib/completion-celebration", () => ({
  celebrateCompletion: mocks.celebrate,
}));

afterEach(() => {
  mocks.update.mockReset();
  mocks.celebrate.mockReset();
});

function run(task: Partial<Task>, result: { completedAt: string | null }) {
  mocks.update.mockResolvedValue(result);
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result: hook } = renderHook(() => useUpdateTaskStatus(), {
    wrapper,
  });
  return hook.current.mutateAsync({
    id: "t1",
    projectId: "p1",
    ...task,
  } as Task);
}

describe("useUpdateTaskStatus", () => {
  it("celebrates when the change completes the task", async () => {
    await run(
      { status: "done", completedAt: null },
      { completedAt: "2026-01-01T00:00:00.000Z" },
    );
    expect(mocks.celebrate).toHaveBeenCalledTimes(1);
  });

  it("does not celebrate a task that stays open or was already done", async () => {
    await run({ status: "in-progress" }, { completedAt: null });
    await run(
      { status: "done", completedAt: "2026-01-01T00:00:00.000Z" },
      { completedAt: "2026-01-01T00:00:00.000Z" },
    );
    expect(mocks.celebrate).not.toHaveBeenCalled();
  });
});
