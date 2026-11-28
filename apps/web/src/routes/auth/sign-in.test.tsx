import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const m = vi.hoisted(() => ({
  config: {} as Record<string, unknown>,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn(), anonymous: vi.fn() },
    emailOtp: { sendVerificationOtp: vi.fn() },
    getLastUsedLoginMethod: () => null,
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => ({ email: "person@example.com" }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { push: vi.fn() } }),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: m.config, isLoading: false }),
}));
vi.mock("@/hooks/queries/instance/use-instance-status", () => ({
  default: () => ({
    data: { hasUsers: true, hasAdmin: true },
    isLoading: false,
  }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { Route } = await import("./sign-in");
const Page = Route.options.component as ComponentType;
const toPassword = { name: "auth:signIn.switchMethod.toPassword" };
const toCode = { name: "auth:signIn.switchMethod.toCode" };
const password = () => screen.queryByLabelText("auth:forms.password");
const email = () => screen.getByLabelText("auth:forms.email");

afterEach(() => cleanup());
beforeEach(() => {
  m.config = { hasSmtp: true };
});

describe("sign-in email methods", () => {
  it("starts on the email code form and swaps to the password form and back", () => {
    render(<Page />);
    expect(password()).toBeNull();
    expect(email()).toHaveValue("person@example.com");
    expect(email()).not.toHaveFocus();

    fireEvent.click(screen.getByRole("button", toPassword));
    expect(password()).toBeInTheDocument();
    expect(email()).toHaveValue("person@example.com");
    expect(email()).toHaveFocus();
    expect(screen.queryByRole("button", toPassword)).toBeNull();

    fireEvent.click(screen.getByRole("button", toCode));
    expect(password()).toBeNull();
    expect(email()).toHaveValue("person@example.com");
    expect(email()).toHaveFocus();
  });

  it.each([{ hasSmtp: false }, { hasSmtp: true, disableEmailOtpSignIn: true }])(
    "shows only the password form for %j",
    (config) => {
      m.config = config;
      render(<Page />);
      expect(password()).toBeInTheDocument();
      expect(screen.queryByRole("button", toCode)).toBeNull();
      expect(screen.queryByRole("button", toPassword)).toBeNull();
    },
  );

  it("shows neither form when the login form is disabled", () => {
    m.config = { hasSmtp: true, disableLoginForm: true, hasGithubSignIn: true };
    render(<Page />);
    expect(screen.queryByLabelText("auth:forms.email")).toBeNull();
    expect(screen.queryByRole("button", toPassword)).toBeNull();
    expect(screen.queryByRole("button", toCode)).toBeNull();
  });
});
