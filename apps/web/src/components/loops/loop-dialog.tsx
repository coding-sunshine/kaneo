import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LOOP_ACTIONS,
  LOOP_EVENT_TRIGGERS,
  LOOP_FREQUENCIES,
  type LoopAction,
  type LoopFrequency,
  type LoopTrigger,
} from "@/components/loops/loop-templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LoopInput } from "@/fetchers/loop/loops";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useLoopMutations } from "@/hooks/mutations/loop/use-loop-mutations";
import { toast } from "@/lib/toast";

export type LoopDraft = {
  /** Set when editing an existing loop. */
  id?: string;
  name: string;
  instructions: string;
  trigger: LoopTrigger;
  frequency: LoopFrequency | null;
  /** Event loops only fire for tasks in this project; null means all. */
  projectId: string | null;
  /** Write tools a run may use; none means read-only. */
  actions: LoopAction[];
};

// One choice picks the trigger: a schedule interval or a task event.
type Choice = LoopFrequency | (typeof LOOP_EVENT_TRIGGERS)[number];
const CHOICES: Choice[] = [...LOOP_FREQUENCIES, ...LOOP_EVENT_TRIGGERS];
const isFrequency = (value: Choice): value is LoopFrequency =>
  (LOOP_FREQUENCIES as string[]).includes(value);

type LoopDialogProps = {
  workspaceId: string;
  draft: LoopDraft | null;
  onClose: () => void;
};

/** Create or edit a loop: name, instructions, trigger and project. */
export function LoopDialog({ workspaceId, draft, onClose }: LoopDialogProps) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        {draft ? (
          <LoopForm workspaceId={workspaceId} draft={draft} onClose={onClose} />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

function LoopForm({
  workspaceId,
  draft,
  onClose,
}: LoopDialogProps & { draft: LoopDraft }) {
  const { t } = useTranslation();
  const { create, update } = useLoopMutations(workspaceId);
  const [name, setName] = useState(draft.name);
  const [instructions, setInstructions] = useState(draft.instructions);
  const [choice, setChoice] = useState<Choice>(
    draft.trigger === "schedule" ? (draft.frequency ?? "daily") : draft.trigger,
  );
  const [projectId, setProjectId] = useState(draft.projectId);
  const [actions, setActions] = useState(draft.actions);
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const isSchedule = isFrequency(choice);
  const pending = create.isPending || update.isPending;
  const valid = name.trim() !== "" && instructions.trim() !== "";

  const save = () => {
    if (!valid) return;
    const input: LoopInput = {
      name: name.trim(),
      instructions: instructions.trim(),
      trigger: isFrequency(choice) ? "schedule" : choice,
      frequency: isFrequency(choice) ? choice : null,
      projectId: isSchedule ? null : projectId,
      actions,
    };
    const options = {
      onSuccess: () => {
        toast.success(t("navigation:loops.saved"));
        onClose();
      },
      onError: (error: Error) => toast.error(error.message),
    };
    if (draft.id) update.mutate({ id: draft.id, ...input }, options);
    else create.mutate(input, options);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t(
            draft.id
              ? "navigation:loops.editTitle"
              : "navigation:loops.newTitle",
          )}
        </DialogTitle>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-3">
        <Input
          autoFocus
          value={name}
          placeholder={t("navigation:loops.namePlaceholder")}
          aria-label={t("navigation:loops.name")}
          onChange={(event) => setName(event.target.value)}
        />
        <Textarea
          value={instructions}
          rows={6}
          placeholder={t("navigation:loops.instructionsPlaceholder")}
          aria-label={t("navigation:loops.instructions")}
          onChange={(event) => setInstructions(event.target.value)}
        />
        <div
          role="radiogroup"
          aria-label={t("navigation:loops.trigger")}
          className="flex flex-wrap gap-2"
        >
          {CHOICES.map((value) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={choice === value}
              variant={choice === value ? "secondary" : "outline"}
              size="sm"
              onClick={() => setChoice(value)}
            >
              {t(
                isFrequency(value)
                  ? `navigation:loops.frequency.${value}`
                  : `navigation:loops.event.${value}`,
              )}
            </Button>
          ))}
        </div>
        {isSchedule ? null : (
          <select
            value={projectId ?? ""}
            aria-label={t("navigation:loops.project")}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            onChange={(event) => setProjectId(event.target.value || null)}
          >
            <option value="">{t("navigation:loops.allProjects")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
        <div
          role="group"
          aria-label={t("navigation:loops.actions")}
          className="flex flex-wrap gap-2"
        >
          {LOOP_ACTIONS.map((action) => (
            <Button
              key={action}
              type="button"
              aria-pressed={actions.includes(action)}
              variant={actions.includes(action) ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setActions((current) =>
                  current.includes(action)
                    ? current.filter((value) => value !== action)
                    : [...current, action],
                )
              }
            >
              {t(`navigation:loops.action.${action}`)}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {t("navigation:loops.permissionNote")}
        </p>
      </DialogPanel>
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button size="sm" disabled={!valid || pending} onClick={save}>
          {t("navigation:loops.save")}
        </Button>
      </DialogFooter>
    </>
  );
}
