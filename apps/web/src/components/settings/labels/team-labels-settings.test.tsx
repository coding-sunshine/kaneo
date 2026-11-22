import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { LabelsSettings } from "./labels-settings";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

type TestLabel = {
  id: string;
  name: string;
  color: string;
  taskId: string | null;
  projectId: string | null;
  parentLabelId: string | null;
  deletionStartedAt: string | null;
};

const label = (id: string, over: Partial<TestLabel> = {}): TestLabel => ({
  id,
  name: id,
  color: "red",
  taskId: null,
  projectId: null,
  parentLabelId: null,
  deletionStartedAt: null,
  ...over,
});

const m = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  labels: [] as unknown[],
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    workspace: { id: "workspace", name: "Workspace" },
    canCreateLabels: () => true,
    canUpdateLabels: () => true,
    canDeleteLabels: () => true,
  }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: m.labels, isPending: false, isError: false }),
}));
vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({ mutateAsync: m.create, isPending: false }),
}));
vi.mock("@/hooks/mutations/label/use-update-label", () => ({
  default: () => ({ mutateAsync: m.update, isPending: false }),
}));
vi.mock("@/hooks/mutations/label/use-delete-label", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  m.labels = [
    label("Workspace label"),
    label("Team A label", { projectId: "teamA" }),
    label("Team A group", { projectId: "teamA" }),
    label("Team B label", { projectId: "teamB" }),
    label("Task copy", { taskId: "task-1", projectId: "teamA" }),
  ];
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("team labels page", () => {
  it("lists only that team's labels", () => {
    render(<LabelsSettings projectId="teamA" />);
    expect(screen.getByText("Team A label")).toBeInTheDocument();
    expect(screen.getByText("Team A group")).toBeInTheDocument();
    expect(screen.queryByText("Workspace label")).not.toBeInTheDocument();
    expect(screen.queryByText("Team B label")).not.toBeInTheDocument();
    expect(screen.queryByText("Task copy")).not.toBeInTheDocument();
  });

  it("the workspace page lists workspace labels only", () => {
    render(<LabelsSettings />);
    expect(screen.getByText("Workspace label")).toBeInTheDocument();
    expect(screen.queryByText("Team A label")).not.toBeInTheDocument();
  });

  it("creates a team label scoped to the team", async () => {
    m.create.mockResolvedValue({ id: "new" });
    render(<LabelsSettings projectId="teamA" />);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "settings:workspaceLabels.newLabel",
      })[0],
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText("settings:workspaceLabels.nameLabel"),
      { target: { value: "Design" } },
    );
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        name: "Design",
        color: "gray",
        workspaceId: "workspace",
        projectId: "teamA",
        parentLabelId: undefined,
      }),
    );
  });
});

describe("label group select", () => {
  const pickGroup = async (groupName: string) => {
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText("settings:workspaceLabels.nameLabel"),
      { target: { value: "Child" } },
    );
    fireEvent.click(
      within(dialog).getByRole("combobox", {
        name: "settings:workspaceLabels.groupLabel",
      }),
    );
    const option = await screen.findByRole("option", { name: groupName });
    fireEvent.pointerDown(option);
    fireEvent.mouseDown(option);
    fireEvent.pointerUp(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option);
    return dialog;
  };

  it("offers this team's and workspace labels as groups, never another team's", async () => {
    render(<LabelsSettings projectId="teamA" />);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "settings:workspaceLabels.newLabel",
      })[0],
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("combobox", {
        name: "settings:workspaceLabels.groupLabel",
      }),
    );
    const names = (await screen.findAllByRole("option")).map(
      (o) => o.textContent,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "settings:workspaceLabels.noGroup",
        "Workspace label",
        "Team A label",
        "Team A group",
      ]),
    );
    expect(names).not.toContain("Team B label");
  });

  it("sends parentLabelId when a group is chosen", async () => {
    m.create.mockResolvedValue({ id: "new" });
    render(<LabelsSettings projectId="teamA" />);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "settings:workspaceLabels.newLabel",
      })[0],
    );
    const dialog = await pickGroup("Team A group");
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Child",
          projectId: "teamA",
          parentLabelId: "Team A group",
        }),
      ),
    );
  });
});
