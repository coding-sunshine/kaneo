import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  AdminBackupStatus,
  AdminRestoreTest,
} from "@/fetchers/admin/backup-types";
import useTestAdminBackupRestore from "@/hooks/mutations/admin/use-test-admin-backup-restore";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useAdminBackups from "@/hooks/queries/admin/use-admin-backups";
import BackupsPanel from "./backups-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}|${Object.values(options).join("|")}` : key,
    i18n: { language: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/admin/use-admin-backups", () => ({
  default: vi.fn(),
}));
vi.mock("@/hooks/queries/admin/use-admin-access", () => ({
  default: vi.fn(),
}));
vi.mock("@/hooks/mutations/admin/use-test-admin-backup-restore", () => ({
  default: vi.fn(),
}));

const success = {
  id: "run-1",
  status: "succeeded",
  startedAt: "2026-11-27T02:41:00.000Z",
  finishedAt: "2026-11-27T02:42:00.000Z",
  sizeBytes: 2048,
  offsiteStatus: "ok",
  errorCode: null,
} as const;

function setup(
  data: AdminBackupStatus,
  {
    permissions = ["system:read", "instance:settings"],
    result,
  }: { permissions?: string[]; result?: AdminRestoreTest } = {},
) {
  vi.mocked(useAdminBackups).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminBackups>);
  vi.mocked(useAdminAccess).mockReturnValue({
    can: (permission: string) => permissions.includes(permission),
  } as unknown as ReturnType<typeof useAdminAccess>);
  const mutate = vi.fn();
  vi.mocked(useTestAdminBackupRestore).mockReturnValue({
    mutate,
    isPending: false,
    data: result,
  } as unknown as ReturnType<typeof useTestAdminBackupRestore>);
  render(<BackupsPanel />);
  return mutate;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BackupsPanel", () => {
  it("says backups are off and which settings turn them on", () => {
    setup({
      enabled: false,
      missingEnv: ["BACKUP_S3_BUCKET", "BACKUP_S3_ACCESS_KEY_ID"],
      lastRun: null,
      lastSuccess: null,
    });

    expect(
      screen.getByText(
        "settings:adminBackups.off.description|BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID",
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /restoreTest.button/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows a red banner when the latest backup failed", () => {
    setup({
      enabled: true,
      missingEnv: [],
      lastRun: {
        ...success,
        id: "run-2",
        status: "failed",
        offsiteStatus: "failed",
        errorCode: "InternalError",
      },
      lastSuccess: success,
    });

    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain("settings:adminBackups.failed.title");
    expect(banner.textContent).toContain("InternalError");
  });

  it("shows the last backup with its offsite copy and runs a restore test", () => {
    const mutate = setup(
      { enabled: true, missingEnv: [], lastRun: success, lastSuccess: success },
      {
        result: {
          status: "passed",
          errorCode: null,
          backupId: "run-1",
          backupStartedAt: success.startedAt,
          restored: { tickets: 4, documents: 2, chatMessages: 9 },
          atBackup: { tickets: 4, documents: 2, chatMessages: 9 },
          live: { tickets: 4, documents: 2, chatMessages: 9 },
          durationMs: 1200,
        },
      },
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByText("settings:adminBackups.last.offsiteOk"),
    ).toBeTruthy();
    expect(screen.getByText(/2.0 KB/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /restoreTest.button/ }));
    expect(mutate).toHaveBeenCalledOnce();
    expect(
      screen.getByText("settings:adminBackups.restoreTest.passed"),
    ).toBeTruthy();
    expect(
      screen.getByRole("row", { name: /restoreTest.chatMessages/ }).textContent,
    ).toContain("99");
  });

  it("keeps the restore test off for a read-only role", () => {
    setup(
      { enabled: true, missingEnv: [], lastRun: success, lastSuccess: success },
      { permissions: ["system:read"] },
    );

    expect(
      screen
        .getByRole("button", { name: /restoreTest.button/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
