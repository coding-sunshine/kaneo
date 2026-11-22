import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkProjectUpdate } from "@/hooks/mutations/work-project/use-work-project-mutations";
import { useWorkProjectUpdates } from "@/hooks/queries/work-project/use-work-project-updates";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { WORK_PROJECT_HEALTHS } from "@/lib/work-project/status";
import { WorkProjectHealth } from "./work-project-health";
import { WorkProjectUpdateItem } from "./work-project-update-item";

type Props = {
  workspaceId: string;
  workProjectId: string;
  editable: boolean;
};

export function WorkProjectUpdates({
  workspaceId,
  workProjectId,
  editable,
}: Props) {
  const { t } = useTranslation();
  const { data: updates } = useWorkProjectUpdates(workProjectId);
  const { mutateAsync: post, isPending } =
    useCreateWorkProjectUpdate(workProjectId);
  const [health, setHealth] =
    useState<(typeof WORK_PROJECT_HEALTHS)[number]>("onTrack");
  const [body, setBody] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post({ health, body: body.trim() });
      setBody("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:workProject.updates.postError"),
      );
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-medium text-sm">
        {t("workspace:workProject.updates.title")}
      </h2>
      {editable && (
        <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
          <div role="radiogroup" className="flex gap-1">
            {WORK_PROJECT_HEALTHS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={health === value}
                onClick={() => setHealth(value)}
                className={cn(
                  "rounded-md px-2 py-1 hover:bg-accent",
                  health === value && "bg-accent",
                )}
              >
                <WorkProjectHealth health={value} />
              </button>
            ))}
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("workspace:workProject.updates.placeholder")}
            aria-label={t("workspace:workProject.updates.placeholder")}
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {t("workspace:workProject.updates.post")}
          </Button>
        </form>
      )}
      {updates?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {t("workspace:workProject.updates.empty")}
        </p>
      )}
      <ul className="space-y-3">
        {updates?.map((update) => (
          <WorkProjectUpdateItem
            key={update.id}
            update={update}
            workspaceId={workspaceId}
          />
        ))}
      </ul>
    </section>
  );
}
