import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateTopic } from "@/hooks/mutations/topic/use-topic-mutations";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";

type NewTopicDialogProps = { workspaceId: string; onClose: () => void };

/**
 * A topic for the whole workspace or for one team. Its creator decides on it.
 * ponytail: no decider or backup picker; the API takes both when one is built.
 */
export function NewTopicDialog({ workspaceId, onClose }: NewTopicDialogProps) {
  const { t } = useTranslation();
  const { data: teams = [] } = useGetProjects({ workspaceId });
  const create = useCreateTopic(workspaceId);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");

  const submit = () =>
    create.mutate(
      { name: name.trim(), projectId: projectId || undefined },
      {
        onSuccess: () => {
          toast.success(t("navigation:documents.topics.created"));
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.topics.new")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.topics.hint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            maxLength={200}
            aria-label={t("navigation:documents.topics.name")}
            placeholder={t("navigation:documents.topics.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            value={projectId}
            aria-label={t("navigation:documents.topics.place")}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">
              {t("navigation:documents.scopes.workspace")}
            </option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={submit}
          >
            {t("navigation:documents.topics.create")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
