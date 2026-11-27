import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CalendarDayEvents from "./calendar-day-events";

afterEach(cleanup);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const event = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  provider: "google" as const,
  title: `Event ${id}`,
  start: "2026-11-10",
  end: "2026-11-10",
  allDay: true,
  meetingUrl: null,
  url: `https://calendar.example.com/${id}`,
  ...over,
});

describe("CalendarDayEvents", () => {
  it("links each event to its calendar and a meeting to its join link", () => {
    render(
      <CalendarDayEvents
        events={[event("a", { meetingUrl: "https://meet.example.com/a" })]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://calendar.example.com/a",
      "https://meet.example.com/a",
    ]);
    expect(
      screen.getByRole("link", { name: "tasks:calendar.joinMeeting" }),
    ).toHaveAttribute("target", "_blank");
  });

  it("caps the list and counts the rest", () => {
    render(
      <CalendarDayEvents
        events={[event("a"), event("b"), event("c")]}
        max={2}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("tasks:calendar.moreEvents")).toBeInTheDocument();
  });
});
