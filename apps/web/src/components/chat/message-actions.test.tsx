import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { ChatMessage } from "@/components/chat/types";
import { MessageActions } from "./message-actions";

const state = vi.hoisted(() => ({
  canCreate: true,
  openWithDraft: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/chat/use-message-mutations", () => ({
  usePinMessage: () => ({ mutate: vi.fn() }),
  useDeleteMessage: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canCreateTasks: () => state.canCreate }),
}));
vi.mock("@/store/create-issue", () => ({
  useCreateIssueStore: (
    select: (store: { openWithDraft: typeof state.openWithDraft }) => unknown,
  ) => select({ openWithDraft: state.openWithDraft }),
}));
vi.mock("@/components/chat/add-to-ticket-dialog", () => ({
  AddToTicketDialog: ({
    open,
    messageId,
  }: {
    open: boolean;
    messageId: string;
  }) => (open ? <p>picker for {messageId}</p> : null),
}));

const message = {
  id: "m1",
  body: "Checkout fails on Safari\nsteps attached",
  userId: "u2",
  pinnedAt: null,
} as unknown as ChatMessage;

const renderActions = () =>
  render(
    <MessageActions
      workspaceId="w1"
      channelId="c1"
      message={message}
      isOwn={false}
      onEdit={vi.fn()}
    />,
  );

const openMenu = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "navigation:chat.messageActions" }),
  );

describe("MessageActions", () => {
  beforeEach(() => {
    state.canCreate = true;
    state.openWithDraft.mockClear();
  });
  afterEach(cleanup);

  it("opens a new ticket that quotes and links the message", async () => {
    renderActions();
    openMenu();
    fireEvent.click(await screen.findByText("navigation:chat.createTicket"));

    expect(state.openWithDraft).toHaveBeenCalledWith({
      title: "Checkout fails on Safari",
      description: `> Checkout fails on Safari\n> steps attached\n\n[navigation:chat.openInChat](${window.location.origin}/dashboard/workspace/w1/channels/c1?messageId=m1)`,
      sourceMessage: { channelId: "c1", messageId: "m1" },
    });
  });

  it("opens the ticket picker for Add to ticket", async () => {
    renderActions();
    openMenu();
    fireEvent.click(await screen.findByText("navigation:chat.addToTicket"));

    expect(await screen.findByText("picker for m1")).toBeTruthy();
  });

  it("hides Create ticket without permission to create tickets", async () => {
    state.canCreate = false;
    renderActions();
    openMenu();

    expect(await screen.findByText("navigation:chat.addToTicket")).toBeTruthy();
    expect(screen.queryByText("navigation:chat.createTicket")).toBeNull();
  });
});
