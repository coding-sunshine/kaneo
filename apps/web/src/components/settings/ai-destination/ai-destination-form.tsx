import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import type { AiDestination } from "@/fetchers/agent/ai-destination";
import { useSetAiDestination } from "@/hooks/mutations/agent/use-set-ai-destination";
import { toast } from "@/lib/toast";

type Provider = AiDestination["provider"];
type AiDestinationFormProps = {
  workspaceId: string;
  destination: AiDestination;
};

const MODEL_NAME = /^[\w.:/@-]+$/;

/** Choose OpenRouter or the server's self-hosted model; admins only. */
export function AiDestinationForm({
  workspaceId,
  destination,
}: AiDestinationFormProps) {
  const { t } = useTranslation();
  const save = useSetAiDestination(workspaceId);
  const [provider, setProvider] = useState<Provider>(destination.provider);
  const [model, setModel] = useState(
    destination.provider === "self-hosted" ? (destination.model ?? "") : "",
  );
  const locked = !destination.canChange;
  const selfHosted = provider === "self-hosted";
  const modelInvalid = selfHosted && !MODEL_NAME.test(model.trim());
  // Only a change is recorded in the AI audit, so the same choice is not saved.
  const unchanged =
    provider === destination.provider &&
    (!selfHosted || model.trim() === (destination.model ?? ""));
  const options = [
    {
      value: "openrouter" as const,
      label: t("settings:aiDestination.providers.openrouter"),
      configured: destination.openRouter.configured,
    },
    {
      value: "self-hosted" as const,
      label: t("settings:aiDestination.providers.selfHosted"),
      configured: destination.selfHosted.configured,
    },
  ];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (locked || modelInvalid || unchanged) return;
    save.mutate(
      selfHosted
        ? { provider: "self-hosted", model: model.trim() }
        : { provider: "openrouter" },
      {
        onSuccess: () => toast.success(t("settings:aiDestination.saved")),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <SettingsCard>
        <SettingsRow stack title={t("settings:aiDestination.provider")}>
          <RadioGroup
            value={provider}
            onValueChange={(next) => setProvider(next as Provider)}
            aria-label={t("settings:aiDestination.provider")}
            disabled={locked}
          >
            {options.map((option) => (
              <Label key={option.value} className="flex items-center gap-2">
                <Radio
                  value={option.value}
                  disabled={locked || !option.configured}
                />
                {option.label}
                {option.configured ? null : (
                  <span className="text-muted-foreground text-xs">
                    {t("settings:aiDestination.notConfigured")}
                  </span>
                )}
              </Label>
            ))}
          </RadioGroup>
        </SettingsRow>
        <SettingsRow
          stack
          title={
            <label htmlFor="ai-destination-model">
              {t("settings:aiDestination.selfHostedModel")}
            </label>
          }
          description={t("settings:aiDestination.selfHostedModelHint")}
        >
          <Input
            id="ai-destination-model"
            className="w-64"
            value={model}
            disabled={locked || !selfHosted}
            aria-invalid={modelInvalid}
            onChange={(event) => setModel(event.target.value)}
          />
        </SettingsRow>
      </SettingsCard>
      {locked ? null : (
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={modelInvalid || unchanged || save.isPending}
          >
            {t("settings:aiDestination.save")}
          </Button>
        </div>
      )}
    </form>
  );
}
