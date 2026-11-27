import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { TwoFactorSettings } from "./two-factor-settings";

let session: { user: { twoFactorEnabled: boolean } };
let accounts: { providerId: string }[];
const { generateBackupCodes, disable } = vi.hoisted(() => ({
  generateBackupCodes: vi.fn(async () => ({
    data: { backupCodes: ["code-1"] },
    error: null,
  })),
  disable: vi.fn(async () => ({ data: { status: true }, error: null })),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/queries/use-list-accounts", () => ({
  default: () => ({ data: accounts }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: session, refetch: vi.fn() }),
    twoFactor: { generateBackupCodes, disable },
  },
}));

describe("TwoFactorSettings", () => {
  beforeEach(() => {
    session = { user: { twoFactorEnabled: false } };
    accounts = [{ providerId: "credential" }];
  });
  afterEach(cleanup);

  it("offers to turn two-factor on for a password user", () => {
    render(<TwoFactorSettings />);
    expect(
      screen.getByRole("button", {
        name: "settings:securityPage.twoFactor.turnOn",
      }),
    ).toBeVisible();
  });

  it("offers turning off and new recovery codes once it is on", () => {
    session.user.twoFactorEnabled = true;
    render(<TwoFactorSettings />);
    expect(
      screen.getByRole("button", {
        name: "settings:securityPage.twoFactor.turnOff",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "settings:securityPage.twoFactor.newCodes",
      }),
    ).toBeVisible();
  });

  it("asks for a current code before making new recovery codes", async () => {
    session.user.twoFactorEnabled = true;
    render(<TwoFactorSettings />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:securityPage.twoFactor.newCodes",
      }),
    );
    fireEvent.change(
      await screen.findByLabelText("settings:securityPage.currentPassword"),
      { target: { value: "secret password" } },
    );
    const confirm = screen
      .getAllByRole("button", {
        name: "settings:securityPage.twoFactor.newCodes",
      })
      .at(-1);
    expect(confirm).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText("settings:securityPage.twoFactor.currentCode"),
      { target: { value: "123456" } },
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm as HTMLElement);
    await waitFor(() =>
      expect(generateBackupCodes).toHaveBeenCalledWith({
        password: "secret password",
        code: "123456",
      }),
    );
  });

  it("asks for a current code before turning two-factor off", async () => {
    session.user.twoFactorEnabled = true;
    render(<TwoFactorSettings />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:securityPage.twoFactor.turnOff",
      }),
    );
    fireEvent.change(
      await screen.findByLabelText("settings:securityPage.currentPassword"),
      { target: { value: "secret password" } },
    );
    const confirm = screen
      .getAllByRole("button", {
        name: "settings:securityPage.twoFactor.turnOff",
      })
      .at(-1);
    expect(confirm).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText("settings:securityPage.twoFactor.currentCode"),
      { target: { value: "654321" } },
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm as HTMLElement);
    await waitFor(() =>
      expect(disable).toHaveBeenCalledWith({
        password: "secret password",
        code: "654321",
      }),
    );
  });

  it("asks a user without a password to set one first", () => {
    accounts = [{ providerId: "github" }];
    render(<TwoFactorSettings />);
    expect(
      screen.getByText("settings:securityPage.twoFactor.needsPassword"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "settings:securityPage.twoFactor.turnOn",
      }),
    ).toBeNull();
  });
});
