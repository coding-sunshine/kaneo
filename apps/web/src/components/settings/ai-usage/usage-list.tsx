import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";

type UsageListProps = {
  label: string;
  empty: string;
  rows: { key: string; title: string; detail: string }[];
};

/** One card listing a usage breakdown, one row per feature or day. */
export function UsageList({ label, empty, rows }: UsageListProps) {
  return (
    <SettingsCard role="list" aria-label={label}>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.key} role="listitem">
            <SettingsRow title={row.title}>
              <span className="text-sm tabular-nums text-muted-foreground">
                {row.detail}
              </span>
            </SettingsRow>
          </div>
        ))
      )}
    </SettingsCard>
  );
}
