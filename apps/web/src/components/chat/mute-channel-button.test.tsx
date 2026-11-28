import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ChatChannelDetail } from "@/components/chat/types";
import { MuteChannelButton } from "./mute-channel-button";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/mutations/chat/use-channel-mutations", () => ({
  useMuteChannel: () => ({ mutate, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

const channel = (isMuted: boolean) =>
  ({ id: "ch-1", isMuted }) as unknown as ChatChannelDetail;

describe("mute channel button", () => {
  it("mutes an unmuted channel", () => {
    render(<MuteChannelButton workspaceId="ws-1" channel={channel(false)} />);
    const button = screen.getByRole("button", {
      name: "navigation:chat.mute",
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(mutate).toHaveBeenCalledWith(true, expect.anything());
  });

  it("unmutes a muted channel", () => {
    render(<MuteChannelButton workspaceId="ws-1" channel={channel(true)} />);
    const button = screen.getByRole("button", {
      name: "navigation:chat.unmute",
    });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(mutate).toHaveBeenCalledWith(false, expect.anything());
  });
});
