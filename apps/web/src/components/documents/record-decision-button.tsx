import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Topic } from "@/fetchers/topic/topics";
import { MakeCurrentDialog } from "./make-current-dialog";
import {
  type RecordedDecision,
  RecordDecisionDialog,
} from "./record-decision-dialog";

type Step =
  | { name: "closed" }
  | { name: "writing" }
  | { name: "approving"; document: RecordedDecision; reason: string };

// Only the people who decide get the button. The API checks who decides again.
export function RecordDecisionButton({ topic }: { topic: Topic }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>({ name: "closed" });
  if (!topic.canDecide) return null;
  const close = () => setStep({ name: "closed" });

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={() => setStep({ name: "writing" })}
      >
        {t("navigation:documents.decision.action")}
      </Button>
      {step.name === "writing" && (
        <RecordDecisionDialog
          topic={topic}
          onClose={close}
          onApprove={(document, reason) =>
            setStep({ name: "approving", document, reason })
          }
        />
      )}
      {step.name === "approving" && (
        <MakeCurrentDialog
          document={step.document}
          topic={topic}
          initialReason={step.reason}
          onClose={close}
        />
      )}
    </>
  );
}
