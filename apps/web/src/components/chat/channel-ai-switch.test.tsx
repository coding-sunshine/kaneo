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
import { ChannelAiSwitch } from "./channel-ai-switch";

const state = vi.hoisted(() => ({
  guest: false,
  hasAgent: true,
  update: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/chat/use-channel-mutations", () => ({
  useUpdateChannel: () => ({ mutate: state.update, isPending: false }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-my-project-access", () => ({
  default: () => ({ data: { guest: state.guest } }),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => state.hasAgent,
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

const channel = (extra: Partial<ChatChannelDetail> = {}) =>
  ({
    id: "channel",
    isMember: true,
    isDirect: false,
    aiDisabled: false,
    ...extra,
  }) as unknown as ChatChannelDetail;

describe("ChannelAiSwitch", () => {
  beforeEach(() => {
    state.guest = false;
    state.hasAgent = true;
    state.update.mockReset();
  });
  afterEach(cleanup);

  it("turns AI off in a channel from the header, and back on", () => {
    const { rerender } = render(
      <ChannelAiSwitch workspaceId="w1" channel={channel()} />,
    );
    const off = screen.getByRole("button", {
      name: "navigation:chat.aiOff",
    });
    expect(off.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(off);
    expect(state.update).toHaveBeenCalledWith(
      { aiDisabled: true },
      expect.anything(),
    );

    rerender(
      <ChannelAiSwitch
        workspaceId="w1"
        channel={channel({ aiDisabled: true })}
      />,
    );
    const on = screen.getByRole("button", { name: "navigation:chat.aiOn" });
    expect(on.getAttribute("aria-pressed")).toBe("true");
    // The state shows in words, not only in a menu or an icon.
    expect(on).toHaveTextContent("navigation:chat.aiOffBadge");
    fireEvent.click(on);
    expect(state.update).toHaveBeenLastCalledWith(
      { aiDisabled: false },
      expect.anything(),
    );
  });

  it("offers the switch in a direct message", () => {
    render(
      <ChannelAiSwitch
        workspaceId="w1"
        channel={channel({ isDirect: true })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.aiOffDirect" }),
    );
    expect(state.update).toHaveBeenCalledWith(
      { aiDisabled: true },
      expect.anything(),
    );
  });

  it("only shows the state to a guest or someone outside the channel", () => {
    state.guest = true;
    const { rerender } = render(
      <ChannelAiSwitch
        workspaceId="w1"
        channel={channel({ aiDisabled: true })}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("navigation:chat.aiOffBadge")).toBeVisible();

    state.guest = false;
    rerender(
      <ChannelAiSwitch
        workspaceId="w1"
        channel={channel({ isMember: false })}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("navigation:chat.aiOffBadge")).toBeNull();
  });

  it("still says AI is off when the server has no AI", () => {
    state.hasAgent = false;
    render(
      <ChannelAiSwitch
        workspaceId="w1"
        channel={channel({ aiDisabled: true })}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("navigation:chat.aiOffBadge")).toBeVisible();
  });
});
