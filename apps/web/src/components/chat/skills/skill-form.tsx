import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSkill } from "@/fetchers/skill/skills";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { skillsKey } from "@/hooks/queries/skill/use-skills";
import { toast } from "@/lib/toast";

/** Saves a prompt as a skill, optionally limited to projects and a monthly cap. */
export function SkillForm({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [cap, setCap] = useState("");
  const save = useMutation({
    mutationFn: () =>
      createSkill(workspaceId, {
        name: name.trim(),
        prompt,
        projectIds: projectIds.length ? projectIds : null,
        monthlyTokenCap: cap ? Number(cap) : null,
      }),
    onSuccess: () => {
      toast.success(t("navigation:chat.skills.saved"));
      setName("");
      setPrompt("");
      setProjectIds([]);
      setCap("");
      void queryClient.invalidateQueries({ queryKey: skillsKey(workspaceId) });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-name">{t("navigation:chat.skills.name")}</Label>
        <Input
          id="skill-name"
          value={name}
          placeholder="blockers"
          pattern="[a-z0-9][a-z0-9\-]{0,31}"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-prompt">
          {t("navigation:chat.skills.prompt")}
        </Label>
        <Textarea
          id="skill-prompt"
          value={prompt}
          rows={4}
          maxLength={4000}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 font-medium text-sm">
          {t("navigation:chat.skills.scope")}
        </legend>
        <p className="text-muted-foreground text-xs">
          {t("navigation:chat.skills.scopeHint")}
        </p>
        {projects.map((project) => (
          <Label
            key={project.id}
            className="flex items-center gap-2 font-normal"
          >
            <Checkbox
              checked={projectIds.includes(project.id)}
              onCheckedChange={(checked) =>
                setProjectIds((ids) =>
                  checked
                    ? [...ids, project.id]
                    : ids.filter((id) => id !== project.id),
                )
              }
            />
            {project.name}
          </Label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-cap">{t("navigation:chat.skills.cap")}</Label>
        <Input
          id="skill-cap"
          type="number"
          min={1}
          value={cap}
          onChange={(event) => setCap(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={!name.trim() || !prompt.trim() || save.isPending}
      >
        {t("navigation:chat.skills.save")}
      </Button>
    </form>
  );
}
