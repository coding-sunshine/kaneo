import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { localDayRange } from "@/lib/people/local-day-range";
import { StatusSection } from "./status-section";

const m = vi.hoisted(() => ({
  mutate: vi.fn(),
  profile: undefined as
    | {
        status: { text: string; clearsAt: string | null } | null;
        outOfOffice: { from: string; until: string } | null;
      }
    | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/user/use-own-profile", () => ({
  default: () => ({ data: m.profile }),
}));
vi.mock("@/hooks/mutations/user/use-update-own-profile", () => ({
  default: () => ({ mutate: m.mutate, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.profile = undefined;
});

describe("StatusSection", () => {
  it("sets a status with an out-of-office range of whole local days", () => {
    render(<StatusSection />);
    type("settings:peopleStatus.text", "In a meeting");
    type("settings:peopleStatus.from", "2026-11-30");
    type("settings:peopleStatus.until", "2026-12-04");
    fireEvent.click(
      screen.getByRole("button", { name: "settings:peopleStatus.save" }),
    );

    expect(m.mutate).toHaveBeenCalledWith(
      {
        status: { text: "In a meeting" },
        outOfOffice: localDayRange("2026-11-30", "2026-12-04"),
      },
      expect.anything(),
    );
  });

  it("refuses a range that ends before it starts", () => {
    render(<StatusSection />);
    type("settings:peopleStatus.from", "2026-12-04");
    type("settings:peopleStatus.until", "2026-11-30");

    expect(
      screen.getByRole("button", { name: "settings:peopleStatus.save" }),
    ).toBeDisabled();
    expect(
      screen.getByText("settings:peopleStatus.invalidRange"),
    ).toBeVisible();
  });

  it("clears a status that is set", () => {
    m.profile = {
      status: { text: "In a meeting", clearsAt: null },
      outOfOffice: null,
    };
    render(<StatusSection />);
    expect(field("settings:peopleStatus.text")).toHaveValue("In a meeting");
    fireEvent.click(
      screen.getByRole("button", { name: "settings:peopleStatus.clear" }),
    );

    expect(m.mutate).toHaveBeenCalledWith(
      { status: null, outOfOffice: null },
      expect.anything(),
    );
  });
});
