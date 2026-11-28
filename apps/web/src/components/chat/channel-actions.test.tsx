import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { ChatChannelDetail } from "@/components/chat/types";
import { ChannelActions } from "./channel-actions";

const state = vi.hoisted(() => ({
  guest: false,
  admin: false,
  update: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/mutations/chat/use-channel-mutations", () => ({
  useUpdateChannel: () => ({ mutate: state.update }),
  useLeaveChannel: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-my-project-access", () => ({
  default: () => ({ data: { guest: state.guest } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateMembers: () => state.admin }),
}));
vi.mock("@/components/chat/add-member-dialog", () => ({
  AddMemberDialog: () => null,
}));
vi.mock("@/components/chat/channel-members-dialog", () => ({
  ChannelMembersDialog: () => null,
}));
vi.mock("@/components/chat/channel-topic-dialog", () => ({
  ChannelTopicDialog: () => null,
}));

const channel = {
  id: "channel",
  name: "client-site",
  isMember: true,
  archivedAt: null,
  memberIds: [],
} as unknown as ChatChannelDetail;

const openMenu = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "navigation:chat.actions" }),
  );

describe("ChannelActions", () => {
  beforeEach(() => {
    state.guest = false;
    state.admin = false;
    state.update.mockReset();
  });
  afterEach(cleanup);

  it("lets a guest only leave", async () => {
    state.guest = true;
    render(<ChannelActions workspaceId="w" channel={channel} />);
    openMenu();
    expect(await screen.findByText("navigation:chat.leave")).toBeVisible();
    expect(screen.queryByText("navigation:chat.addMember")).toBeNull();
    expect(screen.queryByText("navigation:chat.setTopic")).toBeNull();
  });

  it("lets an admin outside the channel manage its members", async () => {
    state.admin = true;
    render(
      <ChannelActions
        workspaceId="w"
        channel={{ ...channel, isMember: false }}
      />,
    );
    openMenu();
    expect(
      await screen.findByText("navigation:chat.manageMembers"),
    ).toBeVisible();
    expect(screen.queryByText("navigation:chat.leave")).toBeNull();
  });

  it("shows nothing to a member outside the channel", () => {
    render(
      <ChannelActions
        workspaceId="w"
        channel={{ ...channel, isMember: false }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "navigation:chat.actions" }),
    ).toBeNull();
  });
});
