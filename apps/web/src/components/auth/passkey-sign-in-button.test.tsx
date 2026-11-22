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
import { PasskeySignInButton } from "./passkey-sign-in-button";

const signInPasskey = vi.fn();
const toastError = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: (m: string) => toastError(m) },
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { passkey: () => signInPasskey() } },
}));

describe("PasskeySignInButton", () => {
  beforeEach(() => {
    signInPasskey.mockReset();
    toastError.mockReset();
  });
  afterEach(cleanup);

  it("calls onSuccess after a passkey sign-in", async () => {
    signInPasskey.mockResolvedValue({ data: {}, error: null });
    const onSuccess = vi.fn();
    render(<PasskeySignInButton onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("auth:signIn.passkey"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("shows the error and stays on the page when sign-in fails", async () => {
    signInPasskey.mockResolvedValue({ data: null, error: { message: "nope" } });
    const onSuccess = vi.fn();
    render(<PasskeySignInButton onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("auth:signIn.passkey"));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("nope"));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
