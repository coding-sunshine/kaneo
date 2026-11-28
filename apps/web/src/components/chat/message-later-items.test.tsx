import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { Menu, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { MessageRemindMenu } from "./message-remind-menu";
import { MessageSaveItem } from "./message-save-item";

const state = vi.hoisted(() => ({
  remind: vi.fn(),
  save: vi.fn(),
  saved: [] as Array<{ id: string }>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/chat/use-later-mutations", () => ({
  useRemindMessage: () => ({ mutate: state.remind }),
  useSaveMessage: () => ({ mutate: state.save }),
}));
vi.mock("@/hooks/queries/chat/use-saved-messages", () => ({
  useSavedMessages: () => ({ data: state.saved }),
}));

const param = { workspaceId: "w1", channelId: "c1", messageId: "m1" };

const renderMenu = () =>
  render(
    <Menu>
      <MenuTrigger>open</MenuTrigger>
      <MenuPopup>
        <MessageRemindMenu {...param} />
        <MessageSaveItem {...param} />
      </MenuPopup>
    </Menu>,
  );

describe("message Remind me and Save", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 7, 21, 30));
    state.remind.mockReset();
    state.save.mockReset();
    state.saved = [];
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("sets a reminder for tomorrow at 9:00", async () => {
    renderMenu();
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByText("navigation:chat.remindMe"));
    fireEvent.click(await screen.findByText("navigation:chat.remindTomorrow"));

    expect(state.remind).toHaveBeenCalledWith(
      { ...param, remindAt: new Date(2026, 0, 8, 9) },
      expect.anything(),
    );
  });

  it("saves a message, and removes one already saved", async () => {
    renderMenu();
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByText("navigation:chat.saveMessage"));
    expect(state.save).toHaveBeenCalledWith(
      { ...param, saved: true },
      expect.anything(),
    );
    cleanup();

    state.saved = [{ id: "m1" }];
    renderMenu();
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByText("navigation:chat.unsaveMessage"));
    expect(state.save).toHaveBeenLastCalledWith(
      { ...param, saved: false },
      expect.anything(),
    );
  });
});
