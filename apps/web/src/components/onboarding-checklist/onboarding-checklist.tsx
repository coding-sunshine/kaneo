import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useCompleteChecklistItem from "@/hooks/mutations/onboarding/use-complete-checklist-item";
import useDismissChecklist from "@/hooks/mutations/onboarding/use-dismiss-checklist";
import useOnboardingChecklist from "@/hooks/queries/onboarding/use-onboarding-checklist";
import { toast } from "@/lib/toast";
import { type ChecklistItemId, checklistItemLink } from "./checklist-item-link";
import { ChecklistItemRow } from "./checklist-item-row";

// The new-hire checklist. Only people who signed up after it existed have
// one, and it stays away once dismissed.
export function OnboardingChecklist() {
  const { t } = useTranslation();
  const { data: checklist } = useOnboardingChecklist();
  const complete = useCompleteChecklistItem();
  const dismiss = useDismissChecklist();
  if (!checklist) return null;

  const labels: Record<ChecklistItemId, string> = {
    "set-status": t("workspace:home.checklist.items.setStatus"),
    "read-handbook": t("workspace:home.checklist.items.readHandbook"),
    "say-hello": t("workspace:home.checklist.items.sayHello"),
    "open-sample-ticket": t("workspace:home.checklist.items.openSampleTicket"),
    "invite-teammate": t("workspace:home.checklist.items.inviteTeammate"),
  };
  const doneCount = checklist.items.filter((item) => item.done).length;

  return (
    <section
      aria-labelledby="onboarding-checklist-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="onboarding-checklist-title"
            className="font-semibold text-[15px] text-foreground"
          >
            {t("workspace:home.checklist.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("workspace:home.checklist.progress", {
              done: doneCount,
              total: checklist.items.length,
            })}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={dismiss.isPending}
          onClick={() =>
            dismiss.mutate(undefined, {
              onError: () =>
                toast.error(t("workspace:home.checklist.dismissError")),
            })
          }
        >
          {t("workspace:home.checklist.dismiss")}
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {checklist.items.map(({ id, done }) => (
          <ChecklistItemRow
            key={id}
            label={labels[id]}
            done={done}
            link={checklistItemLink(id, checklist)}
            onFollow={
              done || id === "set-status"
                ? undefined
                : () => complete.mutate(id)
            }
          />
        ))}
      </ul>
    </section>
  );
}
