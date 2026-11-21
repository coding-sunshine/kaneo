import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkProject } from "@/hooks/mutations/work-project/use-work-project-mutations";
import { toast } from "@/lib/toast";
import { DEFAULT_WORK_PROJECT_COLOR } from "@/lib/work-project/status";
import {
  WorkProjectFields,
  type WorkProjectFieldValues,
} from "./work-project-fields";

const INITIAL: WorkProjectFieldValues = {
  status: "backlog",
  priority: 0,
  leadId: null,
  memberIds: [],
  teamIds: [],
  startDate: null,
  targetDate: null,
};

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  defaultTeamId?: string;
};

export function CreateWorkProjectModal({
  open,
  onClose,
  workspaceId,
  defaultTeamId,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateWorkProject();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<WorkProjectFieldValues>({
    ...INITIAL,
    teamIds: defaultTeamId ? [defaultTeamId] : [],
  });

  const close = () => {
    setName("");
    setSummary("");
    setDescription("");
    setFields({ ...INITIAL, teamIds: defaultTeamId ? [defaultTeamId] : [] });
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await mutateAsync({
        workspaceId,
        name: name.trim(),
        color: DEFAULT_WORK_PROJECT_COLOR,
        summary: summary.trim() || null,
        description: description.trim() || null,
        ...fields,
      });
      toast.success(t("workspace:workProject.create.created"));
      close();
      await navigate({
        to: "/dashboard/workspace/$workspaceId/work-projects/$workProjectId",
        params: { workspaceId, workProjectId: created.id },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:workProject.create.error"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="sr-only">
            {t("workspace:workProject.create.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("workspace:workProject.create.title")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2 px-4">
            <Input
              unstyled
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workspace:workProject.create.name")}
              aria-label={t("workspace:workProject.create.name")}
              className="w-full font-semibold text-xl outline-none"
            />
            <Input
              unstyled
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("workspace:workProject.create.summary")}
              aria-label={t("workspace:workProject.create.summary")}
              className="w-full text-muted-foreground text-sm outline-none"
            />
          </div>
          <div className="px-4">
            <WorkProjectFields
              workspaceId={workspaceId}
              value={fields}
              onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
            />
          </div>
          <div className="px-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("workspace:workProject.create.description")}
              aria-label={t("workspace:workProject.create.description")}
              className="min-h-32"
            />
          </div>
          <DialogFooter className="px-4 pb-4">
            <Button type="button" variant="ghost" onClick={close}>
              {t("workspace:workProject.create.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {t("workspace:workProject.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
