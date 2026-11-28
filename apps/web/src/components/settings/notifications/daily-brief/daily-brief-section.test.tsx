import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DailyBriefSection } from "./daily-brief-section";

const state = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "ws1" } }),
}));
vi.mock("@/hooks/queries/chat/use-channels", () => ({
  useChannels: () => ({
    data: [
      { id: "x", name: "x", isDirect: false, archivedAt: null },
      { id: "y", name: "y", isDirect: false, archivedAt: null },
      { id: "dm", name: "dm", isDirect: true, archivedAt: null },
      {
        id: "off",
        name: "off",
        isDirect: false,
        archivedAt: null,
        aiDisabled: true,
      },
    ],
  }),
}));
const saved: { enabled: boolean; channelIds: string[] } = {
  enabled: false,
  channelIds: [],
};
vi.mock("@/hooks/queries/daily-brief/use-daily-brief", () => ({
  useBriefPreference: () => ({ data: saved }),
  useSetBriefPreference: () => ({ mutate: state.save, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DailyBriefSection", () => {
  it("turns the brief on with only the chosen channel, never a DM", () => {
    render(<DailyBriefSection />);
    fireEvent.click(
      screen.getByLabelText("settings:notificationsPage.dailyBrief.enabled"),
    );
    expect(screen.queryByText("#dm")).toBeNull();
    fireEvent.click(screen.getByText("#x"));
    fireEvent.click(
      screen.getByText("settings:notificationsPage.dailyBrief.save"),
    );
    expect(state.save).toHaveBeenCalledWith(
      { enabled: true, channelIds: ["x"] },
      expect.anything(),
    );
  });

  it("offers no channel marked no AI, and saves without one chosen before", () => {
    saved.enabled = true;
    saved.channelIds = ["off", "y"];
    render(<DailyBriefSection />);
    expect(screen.queryByText("#off")).toBeNull();
    fireEvent.click(screen.getByText("#x"));
    fireEvent.click(
      screen.getByText("settings:notificationsPage.dailyBrief.save"),
    );
    expect(state.save).toHaveBeenCalledWith(
      { enabled: true, channelIds: ["y", "x"] },
      expect.anything(),
    );
    saved.enabled = false;
    saved.channelIds = [];
  });
});
