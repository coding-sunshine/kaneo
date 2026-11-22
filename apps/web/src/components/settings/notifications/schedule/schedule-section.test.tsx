import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { ScheduleSection } from "./schedule-section";

const update = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock(
  "@/hooks/mutations/notification-preferences/use-notification-preferences",
  () => ({
    useUpdateNotificationPreferences: () => ({
      mutateAsync: update,
      isPending: false,
    }),
  }),
);

const preferences = {
  scheduleEnabled: false,
  scheduleTimezone: "UTC",
  scheduleDays: [1, 2, 3, 4, 5],
  scheduleStart: "09:00",
  scheduleEnd: "18:00",
} as NotificationPreferences;

const label = (key: string) =>
  screen.getByLabelText(`settings:notificationsPage.${key}`);

describe("ScheduleSection", () => {
  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("hides the controls and the save button until the schedule is enabled", () => {
    render(<ScheduleSection preferences={preferences} />);
    expect(
      screen.queryByLabelText("settings:notificationsPage.scheduleStart"),
    ).toBeNull();
    expect(
      screen.queryByText("settings:notificationsPage.scheduleSave"),
    ).toBeNull();
  });

  it("saves the schedule once enabled", () => {
    render(<ScheduleSection preferences={preferences} />);
    fireEvent.click(label("scheduleEnabled"));
    fireEvent.change(label("scheduleEnd"), { target: { value: "17:30" } });
    fireEvent.click(
      screen.getByText("settings:notificationsPage.scheduleSave"),
    );
    expect(update).toHaveBeenCalledWith({
      scheduleEnabled: true,
      scheduleTimezone: "UTC",
      scheduleDays: [1, 2, 3, 4, 5],
      scheduleStart: "09:00",
      scheduleEnd: "17:30",
    });
  });

  it("blocks saving when the window is empty", () => {
    render(
      <ScheduleSection
        preferences={{ ...preferences, scheduleEnabled: true }}
      />,
    );
    fireEvent.change(label("scheduleEnd"), { target: { value: "08:00" } });
    expect(
      screen.getByText("settings:notificationsPage.scheduleSave"),
    ).toBeDisabled();
  });

  it("toggles a weekday off", () => {
    render(
      <ScheduleSection
        preferences={{ ...preferences, scheduleEnabled: true }}
      />,
    );
    fireEvent.click(screen.getByText("Fri"));
    fireEvent.click(
      screen.getByText("settings:notificationsPage.scheduleSave"),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleDays: [1, 2, 3, 4] }),
    );
  });
});
