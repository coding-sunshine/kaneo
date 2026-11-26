import { AlertTriangle, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type { TopicDependent } from "@/fetchers/topic/facts";
import {
  useAddFactDependent,
  useClearNeedsReview,
  useRemoveFactDependent,
} from "@/hooks/mutations/topic/use-fact-mutations";
import {
  useNeedsReview,
  useTopicDependents,
  useTopicFacts,
} from "@/hooks/queries/topic/use-facts";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { FactNow } from "./fact-now";

/** The issue or the document that relies on a topic's values. */
export type ReliedWork = { taskId: string } | { documentId: string };

type ReliedFactsProps = {
  workspaceId: string;
  work: ReliedWork;
  topicId: string;
};

/**
 * The values of one topic an issue or a document relies on, and a way to add
 * or drop one. A document never relies on a value it states itself.
 */
export function ReliedFacts({ workspaceId, work, topicId }: ReliedFactsProps) {
  const { t } = useTranslation();
  const { data: dependents = [] } = useTopicDependents(workspaceId, topicId);
  const { data: facts } = useTopicFacts(workspaceId, topicId);
  const isWork = (d: TopicDependent) =>
    "taskId" in work
      ? d.task?.id === work.taskId
      : d.document?.id === work.documentId;
  const relied = dependents.filter(isWork);
  const { data: flagged = [] } = useNeedsReview(
    workspaceId,
    relied.some((d) => d.needsReview),
  );
  const add = useAddFactDependent(workspaceId);
  const remove = useRemoveFactDependent(workspaceId);
  const clear = useClearNeedsReview(workspaceId);
  const onError = (error: Error) => toast.error(error.message);
  const choices = (facts?.answers ?? []).flatMap((a) =>
    a.statementId &&
    a.value &&
    a.documentId &&
    !("documentId" in work && a.documentId === work.documentId) &&
    !relied.some((d) => d.statementId === a.statementId)
      ? [
          {
            ...a,
            statementId: a.statementId,
            value: a.value,
            documentId: a.documentId,
          },
        ]
      : [],
  );
  if (relied.length === 0 && choices.length === 0) return null;

  const text = (name: string, value: string) =>
    t("navigation:documents.facts.relies.item", { name, value });
  const flagFor = (d: TopicDependent) =>
    d.needsReview ? flagged.find((item) => item.id === d.id) : undefined;

  return (
    <div className="flex flex-col gap-1 pl-5">
      {relied.length > 0 && (
        <ul className="flex flex-col gap-1">
          {relied.map((d) => {
            const flag = flagFor(d);
            const label = text(d.slotName, d.value);
            return (
              <li key={d.id} className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-1">
                  <span
                    title={label}
                    className="min-w-0 flex-1 truncate text-xs"
                  >
                    <span className="text-muted-foreground">
                      {t("navigation:documents.facts.relies.title")}
                    </span>{" "}
                    {label}
                  </span>
                  <button
                    type="button"
                    aria-label={t("navigation:documents.facts.relies.remove", {
                      name: d.slotName,
                    })}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        {
                          workspaceId,
                          id: d.statedIn,
                          statementId: d.statementId,
                          dependencyId: d.id,
                        },
                        { onError },
                      )
                    }
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
                {flag && (
                  <div className="flex flex-col items-start gap-1">
                    <p className="flex items-start gap-1.5 text-xs">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0"
                      />
                      {t("navigation:documents.facts.relies.flag", {
                        name: d.slotName,
                        date: formatDateMedium(flag.flaggedAt),
                      })}
                    </p>
                    {flag.cause && (
                      <FactNow workspaceId={workspaceId} cause={flag.cause} />
                    )}
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={clear.isPending}
                      onClick={() =>
                        clear.mutate(
                          { workspaceId, dependencyId: d.id },
                          {
                            onSuccess: () =>
                              toast.success(
                                t(
                                  "navigation:documents.facts.relies.clearDone",
                                ),
                              ),
                            onError,
                          },
                        )
                      }
                    >
                      {t("navigation:documents.facts.relies.clear")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {choices.length > 0 && (
        <Menu>
          <MenuTrigger
            render={<Button size="xs" variant="ghost" className="w-fit" />}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            {t("navigation:documents.facts.relies.add")}
          </MenuTrigger>
          <MenuPopup align="start" className="min-w-44">
            {choices.map((c) => (
              <MenuItem
                key={c.statementId}
                onClick={() =>
                  add.mutate(
                    {
                      workspaceId,
                      id: c.documentId,
                      statementId: c.statementId,
                      ...work,
                    },
                    { onError },
                  )
                }
              >
                {text(c.slotName, c.value)}
              </MenuItem>
            ))}
          </MenuPopup>
        </Menu>
      )}
    </div>
  );
}
