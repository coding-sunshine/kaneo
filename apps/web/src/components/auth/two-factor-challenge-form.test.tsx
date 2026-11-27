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
import { TwoFactorChallengeForm } from "./two-factor-challenge-form";

// The OTP input measures itself on mount, which jsdom cannot do.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
document.elementFromPoint = () => null;

const verifyTotp = vi.fn();
const verifyBackupCode = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyTotp: (...args: unknown[]) => verifyTotp(...args),
      verifyBackupCode: (...args: unknown[]) => verifyBackupCode(...args),
    },
  },
}));

describe("TwoFactorChallengeForm", () => {
  beforeEach(() => {
    verifyTotp.mockReset();
    verifyBackupCode.mockReset();
  });
  afterEach(cleanup);

  it("refuses a wrong code and stays on the step", async () => {
    verifyTotp.mockResolvedValue({ error: { code: "INVALID_CODE" } });
    const onSuccess = vi.fn();
    render(<TwoFactorChallengeForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("auth:twoFactor.codeLabel"), {
      target: { value: "123456" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "auth:twoFactor.wrongCode",
    );
    expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("signs in with a recovery code", async () => {
    verifyBackupCode.mockResolvedValue({ data: {}, error: null });
    const onSuccess = vi.fn();
    render(<TwoFactorChallengeForm onSuccess={onSuccess} />);

    fireEvent.click(screen.getByText("auth:twoFactor.useRecovery"));
    fireEvent.change(screen.getByLabelText("auth:twoFactor.recoveryLabel"), {
      target: { value: " abcde-12345 " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "auth:twoFactor.submit" }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(verifyBackupCode).toHaveBeenCalledWith({ code: "abcde-12345" });
    expect(verifyTotp).not.toHaveBeenCalled();
  });
});
