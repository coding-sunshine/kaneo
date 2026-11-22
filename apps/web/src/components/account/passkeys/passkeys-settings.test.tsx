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
import { PasskeysSettings } from "./passkeys-settings";

const refetch = vi.fn();
const addPasskey = vi.fn();
const deletePasskey = vi.fn();
let list: { data: unknown; isPending: boolean; error: unknown };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/format", () => ({ formatDateMedium: () => "Nov 1, 2026" }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useListPasskeys: () => ({ ...list, refetch }),
    passkey: {
      addPasskey: (...args: unknown[]) => addPasskey(...args),
      deletePasskey: (...args: unknown[]) => deletePasskey(...args),
    },
  },
}));

describe("PasskeysSettings", () => {
  beforeEach(() => {
    list = {
      data: [{ id: "pk-1", name: "Laptop", createdAt: new Date() }],
      isPending: false,
      error: null,
    };
    addPasskey.mockReset().mockResolvedValue({ data: {}, error: null });
    deletePasskey.mockReset().mockResolvedValue({ data: {}, error: null });
    refetch.mockReset();
  });
  afterEach(cleanup);

  it("lists passkeys by name", () => {
    render(<PasskeysSettings />);
    expect(screen.getByText("Laptop")).toBeVisible();
  });

  it("shows the empty state", () => {
    list.data = [];
    render(<PasskeysSettings />);
    expect(
      screen.getByText("settings:securityPage.passkeys.empty"),
    ).toBeVisible();
  });

  it("starts registration from the add button", async () => {
    render(<PasskeysSettings />);
    fireEvent.click(screen.getByText("settings:securityPage.passkeys.add"));
    await waitFor(() => expect(addPasskey).toHaveBeenCalledTimes(1));
  });

  it("deletes only after confirmation", async () => {
    render(<PasskeysSettings />);
    fireEvent.click(
      screen.getByLabelText("settings:securityPage.passkeys.deleteLabel"),
    );
    expect(deletePasskey).not.toHaveBeenCalled();
    const buttons = await screen.findAllByText(
      "settings:securityPage.passkeys.delete",
    );
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() =>
      expect(deletePasskey).toHaveBeenCalledWith({ id: "pk-1" }),
    );
  });
});
