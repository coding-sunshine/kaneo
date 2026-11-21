import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Cycle } from "@/fetchers/cycle/get-cycles";
import type Task from "@/types/task";
import { CycleSubmenu } from "./cycle-submenu";

const state = vi.hoisted(() => ({
  cycles: [] as Partial<Cycle>[],
  update: vi.fn(),
}));

vi.mock("@/hooks/queries/cycle/use-get-cycles", () => ({
  useGetCycles: () => ({ data: state.cycles }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-cycle", () => ({
  useUpdateTaskCycle: () => ({ mutateAsync: state.update }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/ui/context-menu", () => {
  const Pass = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ContextMenuSub: Pass,
    ContextMenuSubTrigger: Pass,
    ContextMenuSubContent: Pass,
    ContextMenuShortcut: Pass,
    ContextMenuCheckboxItem: ({
      children,
      checked,
      onCheckedChange,
    }: {
      children: ReactNode;
      checked: boolean;
      onCheckedChange: () => void;
    }) => (
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        onClick={onCheckedChange}
      >
        {children}
      </button>
    ),
  };
});

afterEach(() => {
  cleanup();
  state.cycles = [];
  state.update.mockReset();
});

const task = { id: "t1", projectId: "p1", cycleId: null } as unknown as Task;

describe("CycleSubmenu", () => {
  it("is hidden for a team without cycles", () => {
    const { container } = render(<CycleSubmenu task={task} />);
    expect(container.textContent).toBe("");
  });

  it("lists the team's cycles and moves the issue into one", () => {
    const day = 86_400_000;
    state.cycles = [
      {
        id: "c1",
        number: 4,
        name: null,
        startsAt: new Date(Date.now() - day).toISOString(),
        endsAt: new Date(Date.now() + day).toISOString(),
        completedAt: null,
      },
    ];
    render(<CycleSubmenu task={task} />);

    expect(screen.getByText("tasks:properties.cycle")).toBeTruthy();
    fireEvent.click(screen.getByText("Cycle 4"));
    expect(state.update).toHaveBeenCalledWith({ task, cycleId: "c1" });
  });
});
