import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateInitiative } from "@/hooks/mutations/initiative/use-initiative-mutations";
import { toast } from "@/lib/toast";

type Props = { open: boolean; onClose: () => void; workspaceId: string };

export function CreateInitiativeDialog({ open, onClose, workspaceId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateInitiative();
  const [name, setName] = useState("");

  const close = () => {
    setName("");
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await mutateAsync({ workspaceId, name: name.trim() });
      toast.success(t("workspace:initiative.create.created"));
      close();
      await navigate({
        to: "/dashboard/workspace/$workspaceId/initiatives/$initiativeId",
        params: { workspaceId, initiativeId: created.id },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:initiative.create.error"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace:initiative.create.title")}</DialogTitle>
          <DialogDescription>
            {t("workspace:initiative.emptyDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("workspace:initiative.create.name")}
            aria-label={t("workspace:initiative.create.name")}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              {t("workspace:initiative.create.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {t("workspace:initiative.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
