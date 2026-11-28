import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import "@/lib/i18n";
import { LoopList } from "./loop-list";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/mutations/loop/use-loop-mutations", () => ({
  useLoopMutations: () => ({
    run: { mutate: mocks.run },
    update: { mutate: vi.fn() },
    remove: { mutate: vi.fn() },
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const loop = {
  id: "loop-1",
  workspaceId: "ws-1",
  creatorId: "user-1",
  creatorName: "Synthetic Person",
  name: "Weekly update",
  instructions: "summarize this week",
  actions: ["create_project_update" as const],
  trigger: "schedule" as const,
  projectId: null,
  frequency: "weekly" as const,
  enabled: true,
  nextRunAt: null,
  lastRunAt: null,
  createdAt: "2026-11-28T00:00:00.000Z",
};

function runNow(result: { status: string; error: string | null }) {
  mocks.run.mockImplementation(
    (_id: string, options: { onSuccess: (run: typeof result) => void }) =>
      options.onSuccess(result),
  );
  render(
    <LoopList
      workspaceId="ws-1"
      loops={[loop]}
      currentUserId="user-1"
      onEdit={vi.fn()}
      onOpenRuns={vi.fn()}
    />,
  );
  fireEvent.contextMenu(screen.getByText("Weekly update"));
  fireEvent.click(screen.getByText("Run now"));
}

describe("LoopList run now", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("says a failed run failed, with its error", () => {
    runNow({ status: "failed", error: "The model request failed" });
    expect(mocks.error).toHaveBeenCalledWith("The model request failed");
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("says a run that worked finished", () => {
    runNow({ status: "succeeded", error: null });
    expect(mocks.success).toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });
});
