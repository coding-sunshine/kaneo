import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LOOP_FREQUENCIES,
  type LoopFrequency,
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
import { useLoopMutations } from "@/hooks/mutations/loop/use-loop-mutations";
import { toast } from "@/lib/toast";

export type LoopDraft = {
  /** Set when editing an existing loop. */
  id?: string;
  name: string;
  instructions: string;
  frequency: LoopFrequency;
};

type LoopDialogProps = {
  workspaceId: string;
  draft: LoopDraft | null;
  onClose: () => void;
};

/** Create or edit a loop: name, instructions and a schedule trigger. */
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
  const [frequency, setFrequency] = useState(draft.frequency);
  const pending = create.isPending || update.isPending;
  const valid = name.trim() !== "" && instructions.trim() !== "";

  const save = () => {
    if (!valid) return;
    const input = {
      name: name.trim(),
      instructions: instructions.trim(),
      frequency,
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
          {LOOP_FREQUENCIES.map((value) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={frequency === value}
              variant={frequency === value ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFrequency(value)}
            >
              {t(`navigation:loops.frequency.${value}`)}
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
