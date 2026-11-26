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
import type { Topic } from "@/fetchers/topic/topics";
import { useUpdateTopic } from "@/hooks/mutations/topic/use-topic-mutations";
import { useTopicDeciderCandidates } from "@/hooks/queries/topic/use-topics";
import { toast } from "@/lib/toast";

type EditTopicDialogProps = {
  topic: Pick<
    Topic,
    | "workspaceId"
    | "id"
    | "name"
    | "deciderId"
    | "deciderName"
    | "backupDeciderId"
  >;
  onClose: () => void;
};

const SELECT = "h-8 rounded-lg border border-input bg-background px-2 text-sm";

/**
 * Rename a topic and name who decides on it. Only people who can open the
 * topic's place are offered; the API checks that again.
 */
export function EditTopicDialog({ topic, onClose }: EditTopicDialogProps) {
  const { t } = useTranslation();
  const { workspaceId, id } = topic;
  const { data: people = [] } = useTopicDeciderCandidates(workspaceId, id);
  const update = useUpdateTopic(workspaceId);
  const [name, setName] = useState(topic.name);
  const [deciderId, setDeciderId] = useState(topic.deciderId ?? "");
  const [backupId, setBackupId] = useState(topic.backupDeciderId ?? "");

  // Only what changed: naming a decider or backup again makes them follow.
  const changes = {
    ...(name.trim() !== topic.name ? { name: name.trim() } : {}),
    ...(deciderId && deciderId !== topic.deciderId ? { deciderId } : {}),
    ...((backupId || null) !== topic.backupDeciderId
      ? { backupDeciderId: backupId || null }
      : {}),
  };
  // A decider no longer offered (they cannot open the place now) still shows.
  const options =
    topic.deciderId &&
    !people.some((person) => person.userId === topic.deciderId)
      ? [{ userId: topic.deciderId, name: topic.deciderName ?? "" }, ...people]
      : people;

  const submit = () =>
    update.mutate(
      { workspaceId, id, ...changes },
      {
        onSuccess: () => {
          toast.success(t("navigation:documents.topics.edit.done"));
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {t("navigation:documents.topics.edit.title")}
          </DialogTitle>
          <DialogDescription>
            {t("navigation:documents.topics.edit.hint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            {t("navigation:documents.topics.edit.name")}
            <Input
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            {t("navigation:documents.topics.edit.decider")}
            <select
              value={deciderId}
              className={SELECT}
              onChange={(event) => {
                setDeciderId(event.target.value);
                // One person cannot be both.
                if (event.target.value === backupId) setBackupId("");
              }}
            >
              {/* The API cannot clear a decider, only name another one. */}
              {!topic.deciderId && (
                <option value="">
                  {t("navigation:documents.topics.edit.choose")}
                </option>
              )}
              {options.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            {t("navigation:documents.topics.edit.backup")}
            <select
              value={backupId}
              className={SELECT}
              onChange={(event) => setBackupId(event.target.value)}
            >
              <option value="">
                {t("navigation:documents.topics.edit.noBackup")}
              </option>
              {people
                .filter((person) => person.userId !== deciderId)
                .map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.name}
                  </option>
                ))}
            </select>
          </label>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={
              !name.trim() ||
              Object.keys(changes).length === 0 ||
              update.isPending
            }
            onClick={submit}
          >
            {t("navigation:documents.topics.edit.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
