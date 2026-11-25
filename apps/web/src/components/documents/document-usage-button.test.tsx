import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentUsageButton } from "./document-usage-button";

const mocks = vi.hoisted(() => ({ role: vi.fn(), usage: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ role: mocks.role() }),
}));
vi.mock("@/hooks/queries/document/use-documents", () => ({
  useDocumentUsage: (workspaceId: string) => mocks.usage(workspaceId),
}));
vi.mock("@/lib/format", () => ({
  formatDateShort: (value: string) => value.slice(0, 10),
}));

const week = (from: string, to: string, numbers: number[]) => ({
  from: `${from}T09:00:00.000Z`,
  to: `${to}T09:00:00.000Z`,
  added: numbers[0],
  filed: numbers[1],
  chatSaves: numbers[2],
});
const usage = {
  topicsWithCurrent: 9,
  weeks: [
    week("2026-01-22", "2026-01-29", [12, 7, 3]),
    week("2026-01-15", "2026-01-22", [20, 4, 1]),
  ],
};
const open = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "navigation:documents.usage.open" }),
  );
const cells = (row: HTMLElement) =>
  [...row.querySelectorAll("th, td")].map((cell) => cell.textContent);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentUsageButton", () => {
  it("shows nothing and asks nothing for a member who is not an owner", () => {
    for (const role of ["member", "admin", "viewer", undefined]) {
      mocks.role.mockReturnValue(role);
      render(<DocumentUsageButton workspaceId="ws" />);
      expect(screen.queryByRole("button")).toBeNull();
      cleanup();
    }
    expect(mocks.usage).not.toHaveBeenCalled();
  });

  it("asks only once an owner opens it, then shows the numbers per week", () => {
    mocks.role.mockReturnValue("admin,owner");
    mocks.usage.mockReturnValue({ data: usage, isError: false });
    render(<DocumentUsageButton workspaceId="ws" />);
    expect(mocks.usage).not.toHaveBeenCalled();

    open();
    expect(mocks.usage).toHaveBeenCalledWith("ws");
    expect(
      screen.getByText('navigation:documents.usage.topics {"count":9}'),
    ).toBeTruthy();
    const [, newest, earlier] = screen.getAllByRole("row");
    expect(cells(newest)).toEqual([
      "navigation:documents.usage.thisWeek",
      "12",
      "7",
      "3",
    ]);
    expect(cells(earlier)).toEqual([
      'navigation:documents.usage.range {"from":"2026-01-15","to":"2026-01-22"}',
      "20",
      "4",
      "1",
    ]);
  });

  it("says so when the numbers cannot be loaded", () => {
    mocks.role.mockReturnValue("owner");
    mocks.usage.mockReturnValue({ data: undefined, isError: true });
    render(<DocumentUsageButton workspaceId="ws" />);
    open();
    expect(screen.getByRole("alert").textContent).toBe(
      "navigation:documents.usage.failed",
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});
