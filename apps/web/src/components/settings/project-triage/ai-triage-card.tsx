import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AiTriageSettings,
  updateAiTriageSettings,
} from "@/fetchers/agent/ai-triage-settings";
import {
  aiTriageSettingsKey,
  useAiTriageSettings,
} from "@/hooks/queries/agent/use-ai-triage-settings";

/** The team's AI triage: guidance for the model, and auto-apply (off by default). */
export function AiTriageCard({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useAiTriageSettings(workspaceId, projectId);
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AiTriageSettings) =>
      updateAiTriageSettings(workspaceId, projectId, body),
    onSuccess: (next) => {
      queryClient.setQueryData(
        aiTriageSettingsKey(workspaceId, projectId),
        next,
      );
      setDraft(null);
    },
    onError: () => toast.error(t("settings:projectTriage.saveFailed")),
  });
  if (!data) return null;
  const guidance = draft ?? data.guidance;

  return (
    <SettingsCard>
      <SettingsRow
        title={t("settings:projectTriage.ai.autoApply")}
        description={t("settings:projectTriage.ai.autoApplyDescription")}
      >
        <Switch
          aria-label={t("settings:projectTriage.ai.autoApply")}
          checked={data.autoApply}
          disabled={save.isPending}
          onCheckedChange={(autoApply) =>
            save.mutate({ guidance: data.guidance, autoApply })
          }
        />
      </SettingsRow>
      <SettingsRow
        stack
        title={t("settings:projectTriage.ai.guidance")}
        description={t("settings:projectTriage.ai.guidanceDescription")}
      >
        <div className="flex w-full flex-col items-end gap-2">
          <Textarea
            aria-label={t("settings:projectTriage.ai.guidance")}
            value={guidance}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            size="sm"
            disabled={draft === null || save.isPending}
            onClick={() => save.mutate({ guidance, autoApply: data.autoApply })}
          >
            {t("settings:projectTriage.ai.save")}
          </Button>
        </div>
      </SettingsRow>
    </SettingsCard>
  );
}
