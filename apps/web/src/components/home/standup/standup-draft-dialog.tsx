import { CopyIcon, NotebookPen } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { StandupDraft } from "@/fetchers/standup/get-standup-draft";
import useStandupDraft from "@/hooks/queries/standup/use-standup-draft";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";
import { formatStandup } from "./format-standup";

type StandupDraftDialogProps = { workspaceId: string };

// The draft lives only in this dialog: nothing is saved or posted, and it
// leaves the page only when the person copies it.
export function StandupDraftDialog({ workspaceId }: StandupDraftDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<1 | 7>(1);
  // An edit belongs to the draft it was made on; a new draft starts fresh.
  const [edit, setEdit] = useState<{ of: StandupDraft; text: string }>();
  const { data, isLoading, isError } = useStandupDraft(workspaceId, days, open);

  const generated = data
    ? formatStandup(
        data,
        {
          did: t("workspace:home.standup.did"),
          doing: t("workspace:home.standup.doing"),
          blocked: t("workspace:home.standup.blocked"),
          none: t("workspace:home.standup.none"),
        },
        (item) =>
          `${window.location.origin}/dashboard/workspace/${workspaceId}/project/${item.projectId}/task/${item.id}`,
      )
    : "";
  const text = edit && edit.of === data ? edit.text : generated;

  const copy = async () => {
    if (await copyToClipboard(text)) {
      toast.success(t("workspace:home.standup.copied"));
    } else {
      toast.error(t("workspace:home.standup.copyFailed"));
    }
  };

  const windows = [
    { value: 1, label: t("workspace:home.standup.today") },
    { value: 7, label: t("workspace:home.standup.week") },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <NotebookPen />
        {t("workspace:home.standup.open")}
      </DialogTrigger>
      <DialogPopup className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("workspace:home.standup.title")}</DialogTitle>
          <DialogDescription>
            {t("workspace:home.standup.private")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <div
            role="group"
            aria-label={t("workspace:home.standup.window")}
            className="flex gap-1.5"
          >
            {windows.map((option) => (
              <Button
                key={option.value}
                size="xs"
                variant={days === option.value ? "secondary" : "ghost"}
                aria-pressed={days === option.value}
                onClick={() => setDays(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : isError ? (
            <p role="alert" className="text-muted-foreground text-sm">
              {t("workspace:home.standup.loadError")}
            </p>
          ) : (
            <Textarea
              aria-label={t("workspace:home.standup.title")}
              value={text}
              onChange={(event) =>
                data && setEdit({ of: data, text: event.target.value })
              }
              rows={12}
              className="font-mono text-xs"
            />
          )}
        </DialogPanel>
        <DialogFooter>
          <Button onClick={copy} disabled={!text || isLoading || isError}>
            <CopyIcon />
            {t("workspace:home.standup.copy")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
