import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkProjectMilestone } from "@/fetchers/work-project/types";
import {
  useCreateMilestone,
  useDeleteMilestone,
  useUpdateMilestone,
} from "@/hooks/mutations/work-project/use-work-project-mutations";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";
import { progressPercent } from "@/lib/work-project/progress";

type Props = {
  workProjectId: string;
  milestones: WorkProjectMilestone[];
};

function MilestoneForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: WorkProjectMilestone;
  onSubmit: (v: { name: string; targetDate: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.targetDate?.slice(0, 10) ?? "");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      targetDate: date ? new Date(`${date}T00:00:00Z`).toISOString() : null,
    });
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1.5">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("workspace:workProject.milestones.name")}
        aria-label={t("workspace:workProject.milestones.name")}
        className="h-8 flex-1"
      />
      <input
        type="date"
        aria-label={t("workspace:workProject.fields.targetDate")}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-[13px]"
      />
      <Button
        type="submit"
        size="icon-sm"
        variant="ghost"
        aria-label={t("workspace:workProject.milestones.save")}
      >
        <Check />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={onCancel}
        aria-label={t("workspace:workProject.milestones.cancel")}
      >
        <X />
      </Button>
    </form>
  );
}

export function WorkProjectMilestones({ workProjectId, milestones }: Props) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const create = useCreateMilestone(workProjectId);
  const update = useUpdateMilestone(workProjectId);
  const remove = useDeleteMilestone(workProjectId);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:workProject.milestones.error"),
      );
      return false;
    }
  };

  return (
    <section aria-labelledby="milestones-heading" className="space-y-1">
      <div className="flex items-center justify-between">
        <h2 id="milestones-heading" className="font-medium text-sm">
          {t("workspace:workProject.milestones.title")}
        </h2>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => setAdding(true)}
          aria-label={t("workspace:workProject.milestones.add")}
          title={t("workspace:workProject.milestones.add")}
        >
          <Plus />
        </Button>
      </div>
      {milestones.length === 0 && !adding && (
        <p className="text-muted-foreground text-[13px]">
          {t("workspace:workProject.milestones.empty")}
        </p>
      )}
      {milestones.map((m) =>
        editingId === m.id ? (
          <MilestoneForm
            key={m.id}
            initial={m}
            onCancel={() => setEditingId(null)}
            onSubmit={async (v) => {
              if (await run(() => update.mutateAsync({ id: m.id, ...v })))
                setEditingId(null);
            }}
          />
        ) : (
          <div
            key={m.id}
            className="group/milestone flex h-9 items-center gap-3 rounded-md px-2 text-[13px] hover:bg-accent/50"
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {m.name}
            </span>
            <span className="text-muted-foreground text-xs">
              {m.targetDate
                ? formatDateShort(m.targetDate)
                : t("workspace:workProject.milestones.noDate")}
            </span>
            <span className="w-16 text-right text-muted-foreground tabular-nums">
              {progressPercent(m.progress)}% of {m.progress.total}
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="opacity-0 group-hover/milestone:opacity-100 focus-visible:opacity-100"
              onClick={() => setEditingId(m.id)}
              aria-label={t("workspace:workProject.milestones.edit")}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="opacity-0 group-hover/milestone:opacity-100 focus-visible:opacity-100"
              onClick={() => run(() => remove.mutateAsync(m.id))}
              aria-label={t("workspace:workProject.milestones.delete")}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      )}
      {adding && (
        <MilestoneForm
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            if (await run(() => create.mutateAsync(v))) setAdding(false);
          }}
        />
      )}
    </section>
  );
}
