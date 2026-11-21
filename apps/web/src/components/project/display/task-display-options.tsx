import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortConfig } from "@/lib/sort-tasks";
import { Switch } from "@/components/ui/switch";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { GROUP_BY_OPTIONS, type GroupBy } from "@/lib/group-project";
import { CardFieldToggles } from "./card-field-toggles";
import { CustomFieldToggles } from "./custom-field-toggles";
import { DisplaySection } from "./display-section";
import { ProjectBackgroundSwitch } from "./project-background-switch";
import { MANUAL_SORT } from "./sort-fields";
import { SortOrderControl } from "./sort-order-control";

type TaskDisplayOptionsProps = {
  projectId: string;
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
  layout: "cards" | "rows";
  showBackgroundSwitch?: boolean;
};

export function TaskDisplayOptions({
  projectId,
  sort,
  onSortChange,
  layout,
  showBackgroundSwitch = false,
}: TaskDisplayOptionsProps) {
  const { t } = useTranslation();
  const groupBy = useUserPreferencesStore((state) => state.listGroupBy);
  const setGroupBy = useUserPreferencesStore((state) => state.setListGroupBy);
  const resetDisplayPreferences = useUserPreferencesStore(
    (state) => state.resetDisplayPreferences,
  );

  const showEmptyColumns = useUserPreferencesStore(
    (state) => state.showEmptyColumns,
  );
  const setShowEmptyColumns = useUserPreferencesStore(
    (state) => state.setShowEmptyColumns,
  );

  return (
    <>
      {layout === "cards" && (
        <DisplaySection>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t("tasks:display.showEmptyColumns")}
            </span>
            <Switch
              checked={showEmptyColumns}
              onCheckedChange={setShowEmptyColumns}
              aria-label={t("tasks:display.showEmptyColumns")}
            />
          </div>
        </DisplaySection>
      )}
      {layout === "rows" && (
        <DisplaySection>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm">
              {t("tasks:display.grouping")}
            </span>
            <Select
              value={groupBy}
              onValueChange={(value) => value && setGroupBy(value as GroupBy)}
            >
              <SelectTrigger
                size="sm"
                className="w-40"
                aria-label={t("tasks:display.grouping")}
              >
                <SelectValue>
                  {t(`tasks:display.groupBy.${groupBy}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`tasks:display.groupBy.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DisplaySection>
      )}
      <DisplaySection>
        <SortOrderControl sort={sort} onSortChange={onSortChange} />
      </DisplaySection>
      <DisplaySection
        title={
          layout === "cards"
            ? t("tasks:display.showOnCards")
            : t("tasks:display.showOnRows")
        }
      >
        <div className="flex flex-col gap-3">
          <CardFieldToggles />
          <CustomFieldToggles projectId={projectId} />
        </div>
      </DisplaySection>
      {showBackgroundSwitch && (
        <DisplaySection>
          <ProjectBackgroundSwitch />
        </DisplaySection>
      )}
      <div className="flex justify-end px-2 py-1.5">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            resetDisplayPreferences();
            onSortChange(MANUAL_SORT);
          }}
        >
          {t("common:actions.reset")}
        </Button>
      </div>
    </>
  );
}
