import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CalendarProviderRow } from "./calendar-provider-row";

afterEach(cleanup);

describe("CalendarProviderRow", () => {
  it("says the instance has no keys and offers no connect link", () => {
    render(
      <CalendarProviderRow
        status={{ provider: "google", state: "not_configured", email: null }}
        onDisconnect={vi.fn()}
        disconnecting={false}
      />,
    );
    expect(
      screen.getByText("settings:calendarSync.notConfigured"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links connect to the API with the return path and time zone", () => {
    render(
      <CalendarProviderRow
        status={{ provider: "microsoft", state: "not_connected", email: null }}
        onDisconnect={vi.fn()}
        disconnecting={false}
      />,
    );
    const href =
      screen
        .getByRole("link", { name: "settings:calendarSync.connect" })
        .getAttribute("href") ?? "";
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toMatch(/\/api\/calendar-sync\/connect\/microsoft$/);
    expect(url.searchParams.get("returnTo")).toBe(
      "/dashboard/settings/account/calendar",
    );
    expect(url.searchParams.get("timeZone")).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("shows the account and disconnects", () => {
    const onDisconnect = vi.fn();
    render(
      <CalendarProviderRow
        status={{
          provider: "google",
          state: "connected",
          email: "person@example.com",
        }}
        onDisconnect={onDisconnect}
        disconnecting={false}
      />,
    );
    expect(screen.getByText("person@example.com")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:calendarSync.disconnect" }),
    );
    expect(onDisconnect).toHaveBeenCalledWith("google");
  });

  it("offers reconnect when the token stopped working", () => {
    render(
      <CalendarProviderRow
        status={{ provider: "google", state: "needs_reconnect", email: null }}
        onDisconnect={vi.fn()}
        disconnecting={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: "settings:calendarSync.reconnect" }),
    ).toBeInTheDocument();
  });
});
