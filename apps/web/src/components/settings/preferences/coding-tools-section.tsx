import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isSafeCodingToolUrl } from "@/lib/coding-tools";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function CodingToolsSection() {
  const { t } = useTranslation();
  const codingTools = useUserPreferencesStore((state) => state.codingTools);
  const toggleCodingTool = useUserPreferencesStore(
    (state) => state.toggleCodingTool,
  );
  const addCodingTool = useUserPreferencesStore((state) => state.addCodingTool);
  const removeCodingTool = useUserPreferencesStore(
    (state) => state.removeCodingTool,
  );

  const [name, setName] = useState("");
  const [urlTemplate, setUrlTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUrl = urlTemplate.trim();
    if (!cleanName || !isSafeCodingToolUrl(cleanUrl)) {
      setError(t("settings:preferencesPage.codingTools.invalidUrl"));
      return;
    }
    addCodingTool({ name: cleanName, urlTemplate: cleanUrl });
    setName("");
    setUrlTemplate("");
    setError(null);
  };

  return (
    <div id="coding-tools">
      <SettingsSection
        title={t("settings:preferencesPage.codingTools.title")}
        description={t("settings:preferencesPage.codingTools.description")}
      >
        <SettingsCard>
          {codingTools.map((tool) => {
            const switchId = `coding-tool-${tool.id}`;
            return (
              <SettingsRow
                key={tool.id}
                className="flex-row items-center gap-6"
                title={<Label htmlFor={switchId}>{tool.name}</Label>}
                description={tool.urlTemplate}
              >
                <div className="flex items-center gap-2">
                  {!tool.builtin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t(
                        "settings:preferencesPage.codingTools.remove",
                        { tool: tool.name },
                      )}
                      onClick={() => removeCodingTool(tool.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                  <Switch
                    id={switchId}
                    checked={tool.enabled}
                    onCheckedChange={(checked) =>
                      toggleCodingTool(tool.id, checked)
                    }
                  />
                </div>
              </SettingsRow>
            );
          })}
          <SettingsRow
            title={t("settings:preferencesPage.codingTools.addTitle")}
          >
            <form
              onSubmit={handleAdd}
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
            >
              <Input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                placeholder={t(
                  "settings:preferencesPage.codingTools.namePlaceholder",
                )}
                aria-label={t(
                  "settings:preferencesPage.codingTools.namePlaceholder",
                )}
                className="sm:w-40"
              />
              <Input
                value={urlTemplate}
                onChange={(event) => {
                  setUrlTemplate(event.target.value);
                  setError(null);
                }}
                placeholder={t(
                  "settings:preferencesPage.codingTools.urlPlaceholder",
                )}
                aria-label={t(
                  "settings:preferencesPage.codingTools.urlPlaceholder",
                )}
                className="flex-1"
              />
              <Button type="submit" size="sm" variant="outline">
                {t("settings:preferencesPage.codingTools.add")}
              </Button>
            </form>
            {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
