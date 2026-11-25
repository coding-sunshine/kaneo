import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ProjectVisibilityPage } from "./project-visibility-page";

const m = vi.hoisted(() => ({
  project: { id: "p1", name: "Website", isPublic: false } as {
    id: string;
    name: string;
    slug?: string;
    isPublic: boolean;
    isPrivate?: boolean;
  },
  canShare: false,
  update: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ projectId: "p1" }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1", name: "Studio" } }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => ({ data: m.project }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    hasPermission: async () => m.canShare,
  }),
}));
vi.mock("@/hooks/mutations/project/use-update-project", () => ({
  default: () => ({ mutateAsync: m.update }),
}));
vi.mock("@/hooks/mutations/project/use-private-team-member", () => ({
  useAddPrivateTeamMember: () => ({ mutate: m.add, isPending: false }),
  useRemovePrivateTeamMember: () => ({ mutate: m.remove, isPending: false }),
}));
vi.mock("@/hooks/queries/project/use-get-private-team-members", () => ({
  default: () => ({
    data: [{ projectId: "p1", userIds: ["u2"] }],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-workspace-users", () => ({
  default: () => ({
    data: [
      { userId: "u1", role: "owner", user: { name: "Olive", email: "o@x.io" } },
      { userId: "u2", role: "member", user: { name: "Max", email: "m@x.io" } },
      { userId: "u3", role: "member", user: { name: "Ann", email: "a@x.io" } },
    ],
    isLoading: false,
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("ProjectVisibilityPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    m.project = { id: "p1", name: "Website", isPublic: false };
    m.canShare = false;
    m.update.mockReset().mockResolvedValue({});
    m.add.mockReset();
    m.remove.mockReset();
  });

  const privateSwitch = () =>
    screen.getByRole("switch", {
      name: "settings:projectVisibility.privateTeam",
    });

  it("hides the link while the project is private", () => {
    render(<ProjectVisibilityPage />);

    expect(
      screen.queryByLabelText("settings:projectVisibility.publicUrl"),
    ).toBeNull();
    expect(screen.queryByText("settings:projectVisibility.on")).toBeNull();
  });

  it("shows the badge and the link while the project is public", () => {
    m.project = { ...m.project, isPublic: true };
    render(<ProjectVisibilityPage />);

    expect(screen.getByText("settings:projectVisibility.on")).toBeTruthy();
    expect(
      screen.getByLabelText("settings:projectVisibility.publicUrl"),
    ).toHaveValue(`${window.location.origin}/public-project/p1`);
  });

  it("keeps the switch disabled until sharing is allowed", async () => {
    const { unmount } = render(<ProjectVisibilityPage />);
    expect(
      screen.getByRole("switch", {
        name: "settings:projectVisibility.publicAccess",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    unmount();

    m.canShare = true;
    render(<ProjectVisibilityPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("switch", {
          name: "settings:projectVisibility.publicAccess",
        }),
      ).not.toHaveAttribute("aria-disabled", "true"),
    );
  });

  it("reflects isPrivate and blocks the public switch", () => {
    m.project = { ...m.project, isPrivate: true };
    m.canShare = true;
    render(<ProjectVisibilityPage />);

    expect(privateSwitch()).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", {
        name: "settings:projectVisibility.publicAccess",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("settings:projectVisibility.publicBlockedByPrivate"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings:projectVisibility.membersDescriptionPrivate"),
    ).toBeTruthy();
  });

  it("disables the private switch while the public link is on", async () => {
    m.project = { ...m.project, isPublic: true };
    m.canShare = true;
    render(<ProjectVisibilityPage />);

    expect(privateSwitch()).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("settings:projectVisibility.privateBlockedByPublic"),
    ).toBeTruthy();
  });

  it("asks before making the team private, then sends isPrivate", async () => {
    m.canShare = true;
    render(<ProjectVisibilityPage />);
    await waitFor(() =>
      expect(privateSwitch()).not.toHaveAttribute("aria-disabled", "true"),
    );

    fireEvent.click(privateSwitch());
    expect(m.update).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByText("settings:projectVisibility.makePrivateConfirm"),
    );

    await waitFor(() => expect(m.update).toHaveBeenCalledTimes(1));
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "p1",
        name: "Website",
        isPublic: false,
        isPrivate: true,
      }),
    );
  });

  it("lists non-owners and adds or removes them", async () => {
    m.project = { ...m.project, isPrivate: true };
    m.canShare = true;
    render(<ProjectVisibilityPage />);

    const max = await screen.findByRole("checkbox", { name: "Max" });
    expect(screen.queryByRole("checkbox", { name: "Olive" })).toBeNull();
    expect(max).toHaveAttribute("aria-checked", "true");

    fireEvent.click(max);
    expect(m.remove).toHaveBeenCalledWith(
      { projectId: "p1", userId: "u2" },
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Ann" }));
    expect(m.add).toHaveBeenCalledWith(
      { projectId: "p1", userId: "u3" },
      expect.anything(),
    );
  });
});
