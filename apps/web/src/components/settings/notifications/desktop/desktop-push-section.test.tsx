import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DesktopPushState } from "./desktop-push-state";
import { DesktopPushSection } from "./desktop-push-section";

const setEnabled = vi.fn();
let state: DesktopPushState = "off";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./use-desktop-push", () => ({
  useDesktopPush: () => ({ state, loading: false, busy: false, setEnabled }),
}));

afterEach(() => {
  cleanup();
  setEnabled.mockReset();
});

const toggle = () =>
  screen.getByRole("switch", {
    name: "settings:notificationsPage.desktopEnabled",
  });

describe("DesktopPushSection", () => {
  it("turns desktop push on and off", () => {
    state = "off";
    const { rerender } = render(<DesktopPushSection />);
    fireEvent.click(toggle());
    expect(setEnabled).toHaveBeenCalledWith(true);

    state = "on";
    rerender(<DesktopPushSection />);
    expect(
      screen.getByText("settings:notificationsPage.desktopOnHint"),
    ).toBeTruthy();
    fireEvent.click(toggle());
    expect(setEnabled).toHaveBeenLastCalledWith(false);
  });

  it("says the server has push off and keeps the switch disabled", () => {
    state = "server-off";
    render(<DesktopPushSection />);
    expect(
      screen.getByText("settings:notificationsPage.desktopServerOff"),
    ).toBeTruthy();
    expect(toggle().hasAttribute("data-disabled")).toBe(true);
  });

  it("explains a browser that blocks notifications", () => {
    state = "denied";
    render(<DesktopPushSection />);
    expect(
      screen.getByText("settings:notificationsPage.desktopDenied"),
    ).toBeTruthy();
  });
});
