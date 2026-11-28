import { Sparkles } from "lucide-react";
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
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import { SkillForm } from "./skill-form";
import { SkillList } from "./skill-list";
import { SkillRunHistory } from "./skill-run-history";

/** My skills: save a prompt, see the ones I have, and what my runs used. */
export function SkillsDialog({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("navigation:chat.skills.open")}
          />
        }
      >
        <Sparkles />
      </DialogTrigger>
      <DialogPopup className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("navigation:chat.skills.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:chat.skills.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-6">
          {hasAgent ? (
            <>
              <SkillList workspaceId={workspaceId} />
              <SkillForm workspaceId={workspaceId} />
              <section className="flex flex-col gap-2">
                <h3 className="font-medium text-sm">
                  {t("navigation:chat.skills.history")}
                </h3>
                <SkillRunHistory workspaceId={workspaceId} enabled={open} />
              </section>
            </>
          ) : (
            <p role="status" className="text-muted-foreground text-sm">
              {t("navigation:chat.skills.off")}
            </p>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
