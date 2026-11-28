import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { Switch } from "@/components/ui/switch";
import {
  useSemanticSearchSetting,
  useSetSemanticSearchSetting,
} from "@/hooks/queries/semantic-search/use-semantic-search-setting";
import { toast } from "@/lib/toast";

/**
 * The workspace's switch for search by meaning, off by default. Shown only
 * when the server has an embedding service; the API refuses non-admins.
 */
export function SemanticSearchCard({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data } = useSemanticSearchSetting(workspaceId);
  const save = useSetSemanticSearchSetting(workspaceId);
  if (!data) return null;

  return (
    <SettingsCard>
      <SettingsRow
        title={t("settings:semanticSearch.title")}
        description={
          data.egressAllowed
            ? t("settings:semanticSearch.description")
            : t("settings:semanticSearch.egressBlocked")
        }
      >
        <Switch
          aria-label={t("settings:semanticSearch.title")}
          checked={data.enabled}
          disabled={save.isPending || !data.egressAllowed}
          onCheckedChange={(on) =>
            save.mutate(on, { onError: (error) => toast.error(error.message) })
          }
        />
      </SettingsRow>
    </SettingsCard>
  );
}
