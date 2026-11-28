import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { deleteSkill } from "@/fetchers/skill/skills";
import useSkills, { skillsKey } from "@/hooks/queries/skill/use-skills";
import { toast } from "@/lib/toast";

/** My saved skills, each run with /<name> in a channel. */
export function SkillList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useSkills(workspaceId);
  const remove = useMutation({
    mutationFn: (skillId: string) => deleteSkill(workspaceId, skillId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: skillsKey(workspaceId) }),
    onError: (error) => toast.error(error.message),
  });
  const skills = data?.skills ?? [];
  if (skills.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        {t("navigation:chat.skills.none")}
      </p>
    );
  return (
    <ul className="flex flex-col divide-y">
      {skills.map((skill) => (
        <li key={skill.id} className="flex items-center gap-2 py-2 text-sm">
          <span className="font-mono">/{skill.name}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {skill.prompt}
          </span>
          {skill.monthlyTokenCap !== null && (
            <span className="text-muted-foreground text-xs">
              {t("navigation:chat.skills.capValue", {
                count: skill.monthlyTokenCap,
              })}
            </span>
          )}
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t("navigation:chat.skills.delete", {
              name: skill.name,
            })}
            disabled={remove.isPending}
            onClick={() => remove.mutate(skill.id)}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
