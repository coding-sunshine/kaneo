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
import { Label } from "@/components/ui/label";
import type { FactType } from "@/fetchers/topic/facts";
import { useTrackFact } from "@/hooks/mutations/topic/use-fact-mutations";
import { toast } from "@/lib/toast";

type TrackFactDialogProps = {
  workspaceId: string;
  topicId: string;
  onClose: () => void;
};

const TYPES: FactType[] = [
  "date",
  "number",
  "money",
  "person",
  "enum",
  "bool",
  "term",
];

/** The decider names one thing the topic settles, and what kind of value it is. */
export function TrackFactDialog({
  workspaceId,
  topicId,
  onClose,
}: TrackFactDialogProps) {
  const { t } = useTranslation();
  const track = useTrackFact(workspaceId);
  const [name, setName] = useState("");
  const [type, setType] = useState<FactType>("date");
  const [choices, setChoices] = useState("");
  const options = [
    ...new Set(
      choices
        .split(",")
        .map((choice) => choice.trim())
        .filter(Boolean),
    ),
  ];
  const listed = type === "enum";
  const ready = name.trim() && (!listed || options.length >= 2);

  const submit = () =>
    track.mutate(
      {
        workspaceId,
        id: topicId,
        name: name.trim(),
        type,
        ...(listed && { options }),
      },
      {
        onSuccess: () => {
          toast.success(
            t("navigation:documents.facts.topic.trackDone", {
              name: name.trim(),
            }),
          );
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
            {t("navigation:documents.facts.topic.track")}
          </DialogTitle>
          <DialogDescription>
            {t("navigation:documents.facts.topic.trackHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <Label className="flex-col items-start gap-1.5">
            {t("navigation:documents.facts.topic.nameLabel")}
            <Input
              value={name}
              maxLength={80}
              placeholder={t(
                "navigation:documents.facts.topic.namePlaceholder",
              )}
              onChange={(event) => setName(event.target.value)}
            />
          </Label>
          <Label className="flex-col items-start gap-1.5">
            {t("navigation:documents.facts.topic.typeLabel")}
            <select
              value={type}
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              onChange={(event) => setType(event.target.value as FactType)}
            >
              {TYPES.map((key) => (
                <option key={key} value={key}>
                  {t(`navigation:documents.facts.topic.types.${key}`)}
                </option>
              ))}
            </select>
          </Label>
          {listed && (
            <Label className="flex-col items-start gap-1.5">
              {t("navigation:documents.facts.topic.optionsLabel")}
              <Input
                value={choices}
                onChange={(event) => setChoices(event.target.value)}
              />
              <span className="font-normal text-muted-foreground text-xs">
                {t("navigation:documents.facts.topic.optionsHint")}
              </span>
            </Label>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!ready || track.isPending}
            onClick={submit}
          >
            {t("navigation:documents.facts.topic.trackSubmit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
