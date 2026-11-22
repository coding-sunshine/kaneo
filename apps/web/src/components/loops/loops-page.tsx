import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentComposer } from "@/components/agent/agent-composer";
import { LoopDialog, type LoopDraft } from "@/components/loops/loop-dialog";
import { LoopList } from "@/components/loops/loop-list";
import { LoopRunsDialog } from "@/components/loops/loop-runs-dialog";
import { LoopTemplateCard } from "@/components/loops/loop-template-card";
import {
  LOOP_CATEGORIES,
  LOOP_TEMPLATES,
  type LoopCategory,
  type LoopTemplate,
} from "@/components/loops/loop-templates";
import { PillTabs } from "@/components/loops/pill-tabs";
import { Button } from "@/components/ui/button";
import { useLoopMutations } from "@/hooks/mutations/loop/use-loop-mutations";
import { useLoops } from "@/hooks/queries/loop/use-loops";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const blank: LoopDraft = {
  name: "",
  instructions: "",
  trigger: "schedule",
  frequency: "daily",
  projectId: null,
  actions: [],
};

/** Linear's Loops page: your loops, then a builder and template gallery. */
export function LoopsPage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [category, setCategory] = useState<LoopCategory>("featured");
  const [draft, setDraft] = useState<LoopDraft | null>(null);
  const [runsFor, setRunsFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const { data: loops = [] } = useLoops(workspaceId, scope);
  const { draft: buildDraft } = useLoopMutations(workspaceId);

  // One model call fills the form; the person confirms it before it is saved.
  const askToBuild = (description: string) =>
    buildDraft.mutate(description, {
      onSuccess: (result) =>
        setDraft({
          name: result.name,
          instructions: result.instructions,
          trigger: result.trigger,
          frequency: result.frequency ?? null,
          projectId: null,
          actions: result.actions,
        }),
      onError: (error) => toast.error(error.message),
    });

  const fromTemplate = (template: LoopTemplate) =>
    setDraft({
      name: t(`navigation:loops.templates.${template.id}.title`),
      instructions: t(`navigation:loops.templates.${template.id}.instructions`),
      trigger: template.trigger,
      frequency: template.frequency ?? null,
      projectId: null,
      actions: template.actions,
    });

  const templates = LOOP_TEMPLATES.filter((template) =>
    template.categories.includes(category),
  );

  return (
    <div className="h-full overflow-auto">
      <div className="px-4 py-2">
        <PillTabs
          value={scope}
          onChange={setScope}
          tabs={[
            { value: "mine", label: t("navigation:loops.myLoops") },
            { value: "all", label: t("navigation:loops.all") },
          ]}
        />
      </div>
      <LoopList
        workspaceId={workspaceId}
        loops={loops}
        currentUserId={session?.user.id}
        onEdit={setDraft}
        onOpenRuns={setRunsFor}
      />
      <div className="mx-auto flex max-w-[752px] flex-col gap-4 px-4 pt-14 pb-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-medium text-[15px]">
              {t("navigation:loops.createTitle")}
            </h2>
            <p className="text-muted-foreground text-[13px]">
              {t("navigation:loops.createSubtitle")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setDraft(blank)}
          >
            {t("navigation:loops.startFresh")}
          </Button>
        </div>
        <AgentComposer
          placeholder={t("navigation:loops.askPlaceholder")}
          pending={buildDraft.isPending}
          onSubmit={askToBuild}
        />
        <PillTabs
          value={category}
          onChange={setCategory}
          className="mt-2"
          tabs={LOOP_CATEGORIES.map((value) => ({
            value,
            label: t(`navigation:loops.category.${value}`),
          }))}
        />
        {templates.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">
            {t("navigation:loops.noTemplates")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => (
              <LoopTemplateCard
                key={template.id}
                template={template}
                onPick={fromTemplate}
              />
            ))}
          </div>
        )}
      </div>
      <LoopDialog
        workspaceId={workspaceId}
        draft={draft}
        onClose={() => setDraft(null)}
      />
      <LoopRunsDialog
        workspaceId={workspaceId}
        loop={runsFor}
        onClose={() => setRunsFor(null)}
      />
    </div>
  );
}
