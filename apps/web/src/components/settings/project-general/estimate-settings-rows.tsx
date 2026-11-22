import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsRow } from "@/components/settings/settings-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import updateProject from "@/fetchers/project/update-project";
import useGetProject from "@/hooks/queries/project/use-get-project";
import type { ProjectWithTasks } from "@/types/project";

const TYPES = ["none", "exponential", "fibonacci", "linear", "tshirt"] as const;
const FLAGS = [
  "estimateExtended",
  "estimateAllowZero",
  "estimateCountUnestimated",
] as const;
const FLAG_COPY = {
  estimateExtended: "extended",
  estimateAllowZero: "allowZero",
  estimateCountUnestimated: "countUnestimated",
} as const;

type Estimation = Partial<
  Record<(typeof FLAGS)[number], boolean> & {
    estimateType: (typeof TYPES)[number];
  }
>;

/** Linear's team "Issue estimation" setting and its scale options. */
export function EstimateSettingsRows({
  project,
  workspaceId,
  canEdit,
}: {
  project: ProjectWithTasks;
  workspaceId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useGetProject({ id: project.id, workspaceId });
  const type = data?.estimateType ?? "none";
  const save = useMutation({
    mutationFn: (changes: Estimation) =>
      updateProject({
        id: project.id,
        name: project.name,
        slug: project.slug,
        icon: project.icon ?? "Layout",
        description: project.description ?? "",
        isPublic: !!project.isPublic,
        ...changes,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] }),
    onError: () =>
      toast.error(t("settings:projectGeneral.estimates.saveFailed")),
  });
  const copy = (key: string) => t(`settings:projectGeneral.estimates.${key}`);

  return (
    <>
      <SettingsRow title={copy("type")} description={copy("typeHint")}>
        <Select
          value={type}
          disabled={!canEdit}
          onValueChange={(next) =>
            save.mutate({ estimateType: next as (typeof TYPES)[number] })
          }
        >
          <SelectTrigger aria-label={copy("type")} className="w-36" size="sm">
            <SelectValue>{copy(`types.${type}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((option) => (
              <SelectItem key={option} value={option}>
                {copy(`types.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      {type !== "none" &&
        FLAGS.map((flag) => (
          <SettingsRow
            key={flag}
            title={copy(FLAG_COPY[flag])}
            description={copy(`${FLAG_COPY[flag]}Hint`)}
          >
            <Switch
              aria-label={copy(FLAG_COPY[flag])}
              disabled={!canEdit}
              checked={data?.[flag] ?? false}
              onCheckedChange={(checked) => save.mutate({ [flag]: checked })}
            />
          </SettingsRow>
        ))}
    </>
  );
}
