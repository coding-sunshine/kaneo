import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { Input } from "@/components/ui/input";
import updateProject from "@/fetchers/project/update-project";
import useGetProject from "@/hooks/queries/project/use-get-project";
import type { ProjectWithTasks } from "@/types/project";

/** Months after which closed issues are archived; 0 turns auto-archive off. */
export function AutoArchiveRow({
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
  const months = data?.autoArchiveMonths ?? 6;
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: number) =>
      updateProject({
        id: project.id,
        name: project.name,
        slug: project.slug,
        icon: project.icon ?? "Layout",
        description: project.description ?? "",
        isPublic: !!project.isPublic,
        autoArchiveMonths: value,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] }),
  });

  return (
    <SettingsRow title={t("tasks:detail.archived.autoArchive")}>
      <Input
        size="sm"
        type="number"
        min={0}
        max={120}
        className="sm:w-24"
        disabled={!canEdit}
        value={draft ?? String(months)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft !== null && Number.isInteger(n) && n >= 0 && n <= 120)
            save.mutate(n);
          setDraft(null);
        }}
      />
    </SettingsRow>
  );
}
