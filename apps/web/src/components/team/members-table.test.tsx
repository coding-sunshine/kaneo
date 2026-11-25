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
import type {
  WorkspaceUser,
  WorkspaceUserInvitation,
} from "@/types/workspace-user";
import MembersTable from "./members-table";

const copyToClipboard = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("@/lib/copy-to-clipboard", () => ({
  copyToClipboard: (text: string) => copyToClipboard(text),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => success(msg),
    error: (msg: string) => error(msg),
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/format", () => ({
  formatDateMedium: () => "Sep 1, 2026",
}));

vi.mock("@/hooks/mutations/workspace-user/use-cancel-invitation", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const calls: string[] = [];
const removeMember = vi.fn(async (_input: unknown) => {
  calls.push("remove");
});
const handOverDocuments = vi.fn(async (..._args: string[]) => {
  calls.push("handOver");
});

vi.mock("@/hooks/mutations/workspace-user/use-delete-workspace-user", () => ({
  default: () => ({
    mutateAsync: (input: unknown) => removeMember(input),
    isPending: false,
  }),
}));

vi.mock("@/fetchers/document/documents", () => ({
  handOverDocuments: (...args: string[]) => handOverDocuments(...args),
}));

// It asks the API, which these tests do not reach.
vi.mock("./ownerless-documents", () => ({ default: () => null }));

vi.mock(
  "@/hooks/mutations/workspace-user/use-update-workspace-user-role",
  () => ({
    default: () => ({ mutateAsync: vi.fn() }),
  }),
);

vi.mock("@/hooks/queries/workspace/use-workspace-roles", () => ({
  default: () => ({ data: [] }),
}));

const updateProjectAccess = vi.fn();

vi.mock(
  "@/hooks/mutations/workspace-user/use-update-member-project-access",
  () => ({
    default: () => ({ mutateAsync: updateProjectAccess, isPending: false }),
  }),
);

vi.mock(
  "@/hooks/queries/workspace-users/use-get-workspace-project-access",
  () => ({
    default: () => ({
      data: [
        {
          userId: "restricted-user",
          projectAccess: "selected",
          projectIds: ["project-a"],
        },
      ],
    }),
  }),
);

const myProjectAccess = vi.fn(() => ({
  projectAccess: "all",
  projectIds: [] as string[],
}));

vi.mock("@/hooks/queries/workspace-users/use-get-my-project-access", () => ({
  default: () => ({ data: myProjectAccess() }),
}));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "project-a", name: "Alpha" },
      { id: "project-b", name: "Beta" },
    ],
    isLoading: false,
  }),
}));

const canInviteUsers = vi.fn(() => true);

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageTeam: () => true,
    canUpdateMembers: () => true,
    canRemoveMembers: () => true,
    canInviteUsers: () => canInviteUsers(),
  }),
}));

vi.mock("../providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "current-user" } }),
}));

beforeEach(() => {
  canInviteUsers.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  calls.length = 0;
});

const pendingInvitation = {
  id: "invite-1",
  email: "invitee@example.com",
  role: "member",
  status: "pending",
  expiresAt: "2026-09-01T00:00:00.000Z",
} as unknown as WorkspaceUserInvitation;

describe("MembersTable pending invitation row menu", () => {
  it("copies the invitation link for that invitation when 'Copy link' is clicked", async () => {
    copyToClipboard.mockResolvedValue(true);

    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[pendingInvitation]}
        users={[] as WorkspaceUser[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "team:membersTable.ariaInvitationActions",
      }),
    );

    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "team:invitations.copyLink",
      }),
    );

    expect(copyToClipboard).toHaveBeenCalledWith(
      `${window.location.origin}/invitation/accept/invite-1`,
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("team:invitations.linkCopied"),
    );
  });

  it("still opens the cancel confirmation dialog instead of cancelling directly", async () => {
    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[pendingInvitation]}
        users={[] as WorkspaceUser[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "team:membersTable.ariaInvitationActions",
      }),
    );

    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "team:membersTable.cancelInvitation",
      }),
    );

    expect(
      await screen.findByText("team:membersTable.cancelDialogTitle"),
    ).toBeVisible();
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it("hides the row menu entirely when the user lacks canInvite", () => {
    canInviteUsers.mockReturnValue(false);

    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[pendingInvitation]}
        users={[] as WorkspaceUser[]}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "team:membersTable.ariaInvitationActions",
      }),
    ).toBeNull();
  });
});

function makeMember(userId: string, role: string, name: string) {
  return {
    id: `member-${userId}`,
    userId,
    role,
    createdAt: "2026-09-01T00:00:00.000Z",
    user: { id: userId, name, email: `${userId}@example.com`, image: null },
  } as unknown as WorkspaceUser;
}

describe("MembersTable project access", () => {
  const members = [
    makeMember("owner-user", "owner", "Olive Owner"),
    makeMember("current-user", "admin", "Casey Current"),
    makeMember("restricted-user", "member", "Riley Restricted"),
    makeMember("open-user", "member", "Avery All"),
  ];

  it("lets managers edit other members' access but not owners or themselves", () => {
    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[]}
        users={members}
      />,
    );

    const editButtons = screen.getAllByRole("button", {
      name: "team:projectAccess.editAria",
    });
    expect(editButtons).toHaveLength(2);
    expect(
      screen.getAllByText("team:projectAccess.projectCount").length,
    ).toBeGreaterThan(0);
  });

  it("lets a limited manager edit only limited members", () => {
    myProjectAccess.mockReturnValue({
      projectAccess: "selected",
      projectIds: ["project-a"],
    });

    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[]}
        users={members}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: "team:projectAccess.editAria" }),
    ).toHaveLength(1);
    myProjectAccess.mockReturnValue({ projectAccess: "all", projectIds: [] });
  });

  it("saves selected projects for a member from the dialog", async () => {
    updateProjectAccess.mockResolvedValue({});

    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[]}
        users={[members[2]]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.editAria" }),
    );

    expect(
      await screen.findByText("team:projectAccess.dialogTitle"),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Beta" }));
    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.save" }),
    );

    await waitFor(() =>
      expect(updateProjectAccess).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        userId: "restricted-user",
        projectAccess: "selected",
        projectIds: ["project-a", "project-b"],
      }),
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("team:projectAccess.updateSuccess"),
    );
  });

  it("asks for a project instead of saving an empty selection", async () => {
    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[]}
        users={[members[2]]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.editAria" }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "Alpha" }));
    fireEvent.click(
      screen.getByRole("button", { name: "team:projectAccess.save" }),
    );

    expect(
      await screen.findByText("team:projectAccess.selectAtLeastOne"),
    ).toBeVisible();
    expect(updateProjectAccess).not.toHaveBeenCalled();
  });
});

describe("MembersTable removal and the member's private documents", () => {
  const openRemoval = async (owner: boolean) => {
    render(
      <MembersTable
        workspaceId="workspace-1"
        invitations={[]}
        users={[
          makeMember(
            "current-user",
            owner ? "owner" : "admin",
            "Casey Current",
          ),
          makeMember("leaver", "member", "Lee Leaver"),
          makeMember("keeper", "member", "Kim Keeper"),
        ]}
      />,
    );
    const [first] = screen.getAllByRole("button", {
      name: "team:membersTable.ariaRemoveMember",
    });
    fireEvent.click(first);
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "team:membersTable.removeMember",
      }),
    );
    return screen.findByRole("alertdialog");
  };
  const confirm = (dialog: HTMLElement) =>
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "team:membersTable.removeMember",
      }),
    );

  it("removes the member first, then gives their documents to the colleague the owner picked", async () => {
    const dialog = await openRemoval(true);
    fireEvent.click(
      within(dialog).getByRole("combobox", {
        name: "team:membersTable.handOverLabel",
      }),
    );
    const options = await screen.findAllByRole("option");
    // Nobody is offered their own documents on the way out.
    expect(options.map((option) => option.textContent)).toEqual([
      "team:membersTable.handOverNoOne",
      "Casey Current",
      "Kim Keeper",
    ]);
    // The select picks on the pointer sequence, not on a bare click.
    fireEvent.pointerDown(options[2]);
    fireEvent.mouseDown(options[2]);
    fireEvent.pointerUp(options[2]);
    fireEvent.mouseUp(options[2]);
    fireEvent.click(options[2]);
    confirm(dialog);

    await waitFor(() =>
      expect(handOverDocuments).toHaveBeenCalledWith(
        "workspace-1",
        "leaver",
        "keeper",
      ),
    );
    expect(calls).toEqual(["remove", "handOver"]);
  });

  it("hands nothing over when the owner picks no one", async () => {
    confirm(await openRemoval(true));
    await waitFor(() => expect(removeMember).toHaveBeenCalled());
    expect(handOverDocuments).not.toHaveBeenCalled();
  });

  it("does not offer the choice to somebody who is not an owner", async () => {
    const dialog = await openRemoval(false);
    expect(within(dialog).queryByRole("combobox")).toBeNull();
    confirm(dialog);
    await waitFor(() => expect(removeMember).toHaveBeenCalled());
    expect(handOverDocuments).not.toHaveBeenCalled();
  });
});
