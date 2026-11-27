import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ChatPresenceSection } from "./chat-presence-section";

const { setPresence, setting } = vi.hoisted(() => ({
  setPresence: vi.fn(),
  setting: { data: { enabled: false } as { enabled: boolean } | undefined },
}));
vi.mock("@/hooks/queries/chat/use-presence-setting", () => ({
  usePresenceSetting: () => setting,
}));
vi.mock("@/hooks/mutations/chat/use-set-presence", () => ({
  useSetPresence: () => ({ mutate: setPresence, isPending: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChatPresenceSection", () => {
  it("is off by default and turns presence on", () => {
    setting.data = { enabled: false };
    render(<ChatPresenceSection />);
    const toggle = screen.getByRole("switch", {
      name: "settings:preferencesPage.chatPresence",
    });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(setPresence).toHaveBeenCalledWith(true, expect.anything());
  });

  it("turns presence off again", () => {
    setting.data = { enabled: true };
    render(<ChatPresenceSection />);
    fireEvent.click(
      screen.getByRole("switch", {
        name: "settings:preferencesPage.chatPresence",
      }),
    );
    expect(setPresence).toHaveBeenCalledWith(false, expect.anything());
  });
});
