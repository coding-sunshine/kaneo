import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { runSkill, type SkillRunResult } from "@/fetchers/skill/skills";
import { skillRunsKey } from "@/hooks/queries/skill/use-skill-runs";
import useSkills from "@/hooks/queries/skill/use-skills";
import { toast } from "@/lib/toast";
import { parseSkillCommand } from "./parse-skill-command";

/**
 * Runs `/name` when it names one of my saved skills; anything else is left
 * to post as a message. The answer stays in this composer, for me only.
 */
export function useSkillCommand(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  const { data } = useSkills(workspaceId);
  const [result, setResult] = useState<SkillRunResult>();
  const run = useMutation({
    mutationFn: (args: { skillId: string; input?: string }) =>
      runSkill(workspaceId, args.skillId, { channelId, input: args.input }),
    onSuccess: (answer) => {
      setResult(answer);
      void queryClient.invalidateQueries({
        queryKey: skillRunsKey(workspaceId),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const tryRun = (text: string) => {
    const command = parseSkillCommand(text);
    const skill =
      command &&
      data?.skills.find((candidate) => candidate.name === command.name);
    if (!command || !skill) return false;
    run.mutate({ skillId: skill.id, input: command.input });
    return true;
  };

  return {
    tryRun,
    result,
    isRunning: run.isPending,
    dismiss: () => setResult(undefined),
  };
}
