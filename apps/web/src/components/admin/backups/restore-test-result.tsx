import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/settings/status-badge";
import type { AdminRestoreTest } from "@/fetchers/admin/backup-types";

const TABLE_LABELS = {
  tickets: "settings:adminBackups.restoreTest.tickets",
  documents: "settings:adminBackups.restoreTest.documents",
  chatMessages: "settings:adminBackups.restoreTest.chatMessages",
} as const;

type RestoreTestResultProps = {
  result: AdminRestoreTest;
};

export function RestoreTestResult({ result }: RestoreTestResultProps) {
  const { t } = useTranslation();
  const passed = result.status === "passed";

  return (
    <div className="space-y-3 px-4 py-3" aria-live="polite">
      <StatusBadge tone={passed ? "success" : "destructive"}>
        {passed
          ? t("settings:adminBackups.restoreTest.passed")
          : t("settings:adminBackups.restoreTest.failed", {
              code: result.errorCode ?? "UNKNOWN",
            })}
      </StatusBadge>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th scope="col" className="font-medium">
              {t("settings:adminBackups.restoreTest.table")}
            </th>
            <th scope="col" className="text-right font-medium">
              {t("settings:adminBackups.restoreTest.restored")}
            </th>
            <th scope="col" className="text-right font-medium">
              {t("settings:adminBackups.restoreTest.live")}
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {(Object.keys(TABLE_LABELS) as (keyof typeof TABLE_LABELS)[]).map(
            (key) => (
              <tr key={key}>
                <th scope="row" className="text-left font-normal">
                  {t(TABLE_LABELS[key])}
                </th>
                <td className="text-right">{result.restored?.[key] ?? "–"}</td>
                <td className="text-right">{result.live[key]}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
