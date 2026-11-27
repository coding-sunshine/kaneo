import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiBudget } from "@/fetchers/agent/ai-usage";
import { useSetAiBudget } from "@/hooks/mutations/agent/use-set-ai-budget";
import { toast } from "@/lib/toast";
import { parseTokenBudget } from "./parse-token-budget";

type AiBudgetFormProps = { workspaceId: string; budget: AiBudget };

const asText = (value: number | null) => (value === null ? "" : String(value));

/** The per-person daily and workspace monthly token budgets. */
export function AiBudgetForm({ workspaceId, budget }: AiBudgetFormProps) {
  const { t } = useTranslation();
  const save = useSetAiBudget(workspaceId);
  const [daily, setDaily] = useState(asText(budget.userDailyTokens));
  const [monthly, setMonthly] = useState(asText(budget.workspaceMonthlyTokens));
  const userDailyTokens = parseTokenBudget(daily);
  const workspaceMonthlyTokens = parseTokenBudget(monthly);
  const invalid =
    userDailyTokens === undefined || workspaceMonthlyTokens === undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (userDailyTokens === undefined || workspaceMonthlyTokens === undefined)
      return;
    save.mutate(
      { userDailyTokens, workspaceMonthlyTokens },
      {
        onSuccess: () => toast.success(t("settings:aiUsage.saved")),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <SettingsCard>
        <SettingsRow
          stack
          title={
            <label htmlFor="ai-budget-daily">
              {t("settings:aiUsage.userDaily")}
            </label>
          }
          description={t("settings:aiUsage.userDailyHint")}
        >
          <Input
            id="ai-budget-daily"
            inputMode="numeric"
            className="w-40"
            placeholder={t("settings:aiUsage.noLimit")}
            value={daily}
            aria-invalid={userDailyTokens === undefined}
            onChange={(event) => setDaily(event.target.value)}
          />
        </SettingsRow>
        <SettingsRow
          stack
          title={
            <label htmlFor="ai-budget-monthly">
              {t("settings:aiUsage.workspaceMonthly")}
            </label>
          }
          description={t("settings:aiUsage.workspaceMonthlyHint")}
        >
          <Input
            id="ai-budget-monthly"
            inputMode="numeric"
            className="w-40"
            placeholder={t("settings:aiUsage.noLimit")}
            value={monthly}
            aria-invalid={workspaceMonthlyTokens === undefined}
            onChange={(event) => setMonthly(event.target.value)}
          />
        </SettingsRow>
      </SettingsCard>
      <div className="flex items-center justify-end gap-3">
        {invalid ? (
          <p role="alert" className="text-xs text-destructive">
            {t("settings:aiUsage.invalid")}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={invalid || save.isPending}>
          {t("settings:aiUsage.save")}
        </Button>
      </div>
    </form>
  );
}
