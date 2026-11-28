import { useMutation } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { catchUp } from "@/fetchers/catch-up/catch-up";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import {
  useCatchUpPreference,
  useSetCatchUpPreference,
} from "@/hooks/queries/catch-up/use-catch-up-preference";
import { CatchUpSourceChip } from "./catch-up-source-chip";

const WINDOWS = [8, 24, 72] as const;

// Private: the summary is made on request for the person asking, kept only
// in this dialog, and never ranks people.
export function CatchUpDialog({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<(typeof WINDOWS)[number]>(24);
  const preference = useCatchUpPreference(workspaceId, open && hasAgent);
  const setPreference = useSetCatchUpPreference(workspaceId);
  const run = useMutation({ mutationFn: () => catchUp(workspaceId, hours) });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) run.reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <History />
        {t("workspace:home.catchUp.open")}
      </DialogTrigger>
      <DialogPopup className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("workspace:home.catchUp.title")}</DialogTitle>
          <DialogDescription>
            {t("workspace:home.catchUp.private")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-4">
          {!hasAgent ? (
            <p role="status" className="text-muted-foreground text-sm">
              {t("workspace:home.catchUp.off")}
            </p>
          ) : (
            <>
              <div
                role="group"
                aria-label={t("workspace:home.catchUp.window")}
                className="flex gap-1.5"
              >
                {WINDOWS.map((value) => (
                  <Button
                    key={value}
                    size="xs"
                    variant={hours === value ? "secondary" : "ghost"}
                    aria-pressed={hours === value}
                    onClick={() => setHours(value)}
                  >
                    {t("workspace:home.catchUp.hours", { count: value })}
                  </Button>
                ))}
              </div>
              <Label className="flex items-center gap-2 font-normal">
                <Switch
                  checked={preference.data?.includeDirectMessages ?? false}
                  disabled={!preference.data || setPreference.isPending}
                  onCheckedChange={(checked) => setPreference.mutate(checked)}
                />
                {t("workspace:home.catchUp.includeDirectMessages")}
              </Label>
              <Button
                size="sm"
                className="self-start"
                disabled={run.isPending}
                onClick={() => run.mutate()}
              >
                {run.isPending
                  ? t("workspace:home.catchUp.running")
                  : t("workspace:home.catchUp.run")}
              </Button>
              {run.isError && (
                <p role="alert" className="text-destructive text-sm">
                  {run.error.message}
                </p>
              )}
              {run.data &&
                (run.data.bullets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("workspace:home.catchUp.empty")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {run.data.bullets.map((bullet) => (
                      <li key={bullet.text} className="flex flex-col gap-1">
                        <span>{bullet.text}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {bullet.sources.map((source, index) => (
                            <CatchUpSourceChip
                              key={
                                source.restricted
                                  ? `r-${index}`
                                  : `${source.kind}-${source.id}`
                              }
                              workspaceId={workspaceId}
                              source={source}
                            />
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}
            </>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
