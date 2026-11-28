import { useTranslation } from "react-i18next";
import useSkillRuns from "@/hooks/queries/skill/use-skill-runs";
import { formatDate } from "@/lib/format";

/** My latest skill runs and the tokens each used. */
export function SkillRunHistory({
  workspaceId,
  enabled,
}: {
  workspaceId: string;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const { data } = useSkillRuns(workspaceId, enabled);
  const runs = data?.runs ?? [];
  if (runs.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        {t("navigation:chat.skills.noRuns")}
      </p>
    );
  return (
    <ul
      aria-label={t("navigation:chat.skills.history")}
      className="flex flex-col divide-y"
    >
      {runs.map((run) => (
        <li key={run.id} className="flex items-center gap-2 py-2 text-sm">
          <span className="font-mono">/{run.skillName}</span>
          <span className="flex-1 text-muted-foreground text-xs">
            {formatDate(new Date(run.createdAt), {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("navigation:chat.skills.tokens", {
              count: run.promptTokens + run.completionTokens,
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
