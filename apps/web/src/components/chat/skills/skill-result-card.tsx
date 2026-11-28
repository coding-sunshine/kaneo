import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentSourceChip } from "@/components/agent/agent-source-chip";
import { Button } from "@/components/ui/button";
import type { SkillRunResult } from "@/fetchers/skill/skills";

/** A skill's answer, shown only to the person who ran it. */
export function SkillResultCard({
  workspaceId,
  result,
  onDismiss,
}: {
  workspaceId: string;
  result: SkillRunResult;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("navigation:chat.skills.resultTitle", {
        name: result.skillName,
      })}
      className="mx-3 mt-3 flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 text-sm"
    >
      <header className="flex items-center gap-2">
        <h3 className="flex-1 font-medium">
          {t("navigation:chat.skills.resultTitle", { name: result.skillName })}
        </h3>
        <span className="text-muted-foreground text-xs">
          {t("navigation:chat.skills.onlyYou")}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("navigation:chat.skills.dismiss")}
          onClick={onDismiss}
        >
          <X />
        </Button>
      </header>
      {result.bullets.length === 0 ? (
        <p className="text-muted-foreground">
          {t("navigation:chat.skills.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {result.bullets.map((bullet) => (
            <li key={bullet.text} className="flex flex-col gap-1">
              <span>{bullet.text}</span>
              <span className="flex flex-wrap gap-1.5">
                {bullet.sources.map((citation, index) => (
                  <AgentSourceChip
                    key={
                      citation.restricted
                        ? `r-${index}`
                        : `${citation.kind}-${citation.id}`
                    }
                    workspaceId={workspaceId}
                    citation={citation}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">
        {t("navigation:chat.skills.tokens", {
          count: result.promptTokens + result.completionTokens,
        })}
      </p>
    </section>
  );
}
