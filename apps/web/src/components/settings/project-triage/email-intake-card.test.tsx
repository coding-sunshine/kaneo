import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EmailIntakeCard } from "./email-intake-card";

type Intake = {
  available: boolean;
  repliesAvailable: boolean;
  address: string | null;
};
const state = vi.hoisted(() => ({
  intake: null as Intake | null,
  isError: false,
  setEmailIntake: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/queries/email-intake/use-email-intake", () => ({
  useEmailIntake: () => ({ data: state.intake, isError: state.isError }),
}));
vi.mock("@/fetchers/email-intake/set-email-intake", () => ({
  default: state.setEmailIntake,
}));

const key = (name: string) => `settings:projectTriage.emailIntake.${name}`;
const address = "help+0123456789abcdef0123456789abcdef@intake.example.test";

function show(intake: Intake | null, isError = false) {
  state.intake = intake;
  state.isError = isError;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailIntakeCard projectId="team-1" />
    </QueryClientProvider>,
  );
}

describe("EmailIntakeCard", () => {
  afterEach(() => {
    cleanup();
    state.setEmailIntake.mockReset();
  });

  it("says intake is off on the instance and offers no switch", () => {
    show({ available: false, repliesAvailable: false, address: null });
    expect(screen.getByRole("status").textContent).toBe(key("off"));
    expect(screen.queryByRole("button", { name: key("enable") })).toBeNull();
  });

  it("turns intake on", async () => {
    show({ available: true, repliesAvailable: false, address: null });
    state.setEmailIntake.mockResolvedValue({
      available: true,
      repliesAvailable: false,
      address,
    });
    fireEvent.click(screen.getByRole("button", { name: key("enable") }));
    await waitFor(() =>
      expect(state.setEmailIntake).toHaveBeenCalledWith("team-1", true),
    );
  });

  it("shows the address with the reverse action and the missing SMTP", async () => {
    show({ available: true, repliesAvailable: false, address });
    expect(screen.getByText(address)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(key("repliesOff"));
    fireEvent.click(screen.getByRole("button", { name: key("disable") }));
    await waitFor(() =>
      expect(state.setEmailIntake).toHaveBeenCalledWith("team-1", false),
    );
  });

  it("shows nothing to someone the API refuses", () => {
    show(null, true);
    expect(screen.queryByText(key("title"))).toBeNull();
  });
});
