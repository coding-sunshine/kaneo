import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import MemberProjectAccessDialog from "./member-project-access-dialog";

const m = vi.hoisted(() => ({
  privateTeams: { data: undefined, isError: false } as {
    data: { projectId: string; userIds: string[] }[] | undefined;
    isError: boolean;
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock(
  "@/hooks/mutations/workspace-user/use-update-member-project-access",
  () => ({
    default: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }),
);
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Secret", isPrivate: true },
      { id: "c", name: "Hidden", isPrivate: true },
    ],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-my-project-access", () => ({
  default: () => ({
    isPending: false,
    isError: false,
    data: { projectAccess: "all", projectIds: [] },
  }),
}));
vi.mock("@/hooks/queries/project/use-get-private-team-members", () => ({
  default: () => m.privateTeams,
}));

const renderDialog = () =>
  render(
    <MemberProjectAccessDialog
      workspaceId="w1"
      open
      member={{ userId: "u1", name: "Max" }}
      access={{ projectAccess: "all", projectIds: [] }}
      onOpenChange={() => {}}
    />,
  );

describe("MemberProjectAccessDialog", () => {
  afterEach(cleanup);

  it("lists the private teams the member is in", () => {
    m.privateTeams = {
      data: [
        { projectId: "b", userIds: ["u1"] },
        { projectId: "c", userIds: ["u9"] },
      ],
      isError: false,
    };
    renderDialog();

    expect(
      screen.getByText("team:projectAccess.privateTeamsLabel"),
    ).toBeTruthy();
    expect(screen.getByText("Secret")).toBeTruthy();
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("shows nothing when the private-team query fails", () => {
    m.privateTeams = { data: undefined, isError: true };
    renderDialog();

    expect(
      screen.queryByText("team:projectAccess.privateTeamsLabel"),
    ).toBeNull();
  });
});
