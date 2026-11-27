import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import { UserConfirmDialog } from "./user-confirm-dialog";

const { resetTwoFactor, idle } = vi.hoisted(() => ({
  resetTwoFactor: vi.fn(async () => ({ twoFactorEnabled: false })),
  idle: () => ({ mutateAsync: async () => undefined, isPending: false }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/mutations/admin/use-reset-admin-user-two-factor", () => ({
  default: () => ({ mutateAsync: resetTwoFactor, isPending: false }),
}));
vi.mock("@/hooks/mutations/admin/use-delete-admin-user", () => ({
  default: idle,
}));
vi.mock("@/hooks/mutations/admin/use-toggle-admin-user-status", () => ({
  default: idle,
}));
vi.mock("@/hooks/mutations/admin/use-send-admin-user-password-reset", () => ({
  default: idle,
}));
vi.mock(
  "@/hooks/mutations/admin/use-send-admin-user-verification-email",
  () => ({
    default: idle,
  }),
);
vi.mock("@/hooks/mutations/admin/use-mark-admin-user-email-verified", () => ({
  default: idle,
}));

const user = {
  id: "user-1",
  name: "Example Person",
  email: "person@example.test",
} as AdminUser;

describe("UserConfirmDialog", () => {
  afterEach(cleanup);

  it("asks for the administrator's own code before resetting two-factor", async () => {
    render(
      <UserConfirmDialog
        action={{ type: "resetTwoFactor", user }}
        onClose={vi.fn()}
      />,
    );
    const confirm = screen.getByRole("button", {
      name: "settings:adminUsers.confirm.resetTwoFactor.action",
    });
    expect(confirm).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText(
        "settings:adminUsers.confirm.resetTwoFactor.codeLabel",
      ),
      { target: { value: " 123456 " } },
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(resetTwoFactor).toHaveBeenCalledWith({ user, code: "123456" }),
    );
  });
});
