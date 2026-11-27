import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type Health,
  HealthPicker,
} from "@/components/work-project/health-picker";
import { useCreateInitiativeUpdate } from "@/hooks/mutations/initiative/use-initiative-mutations";
import { useInitiativeUpdates } from "@/hooks/queries/initiative/use-initiative-updates";
import { toast } from "@/lib/toast";
import { InitiativeUpdateItem } from "./initiative-update-item";

type Props = { workspaceId: string; initiativeId: string; editable: boolean };

export function InitiativeUpdates({
  workspaceId,
  initiativeId,
  editable,
}: Props) {
  const { t } = useTranslation();
  const { data: updates } = useInitiativeUpdates(initiativeId);
  const { mutateAsync: post, isPending } =
    useCreateInitiativeUpdate(initiativeId);
  const [health, setHealth] = useState<Health>("onTrack");
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
          : t("workspace:initiative.updates.postError"),
      );
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-medium text-sm">
        {t("workspace:initiative.updates.title")}
      </h2>
      {editable && (
        <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
          <HealthPicker value={health} onChange={setHealth} />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("workspace:initiative.updates.placeholder")}
            aria-label={t("workspace:initiative.updates.placeholder")}
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {t("workspace:initiative.updates.post")}
          </Button>
        </form>
      )}
      {updates?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {t("workspace:initiative.updates.empty")}
        </p>
      )}
      <ul className="space-y-3">
        {updates?.map((update) => (
          <InitiativeUpdateItem
            key={update.id}
            update={update}
            workspaceId={workspaceId}
          />
        ))}
      </ul>
    </section>
  );
}
