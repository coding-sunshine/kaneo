import { cleanup, render, screen } from "@testing-library/react";
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
    twoFactor: {},
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
