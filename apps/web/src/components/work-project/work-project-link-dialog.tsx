import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddWorkProjectLink } from "@/hooks/mutations/work-project/use-work-project-mutations";
import { toast } from "@/lib/toast";

type Props = { workProjectId: string; onClose: () => void };

/** "Add link" dialog for a project's Resources row. Render it only while open. */
export function WorkProjectLinkDialog({ workProjectId, onClose }: Props) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const add = useAddWorkProjectLink(workProjectId);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = url.trim();
    if (add.isPending || !address) return;
    add.mutate(
      {
        // "example.com" is meant as a web address.
        url: /^(https?:\/\/|\/)/i.test(address)
          ? address
          : `https://${address}`,
        label: title.trim() || undefined,
      },
      { onSuccess: onClose, onError: (error) => toast.error(error.message) },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !add.isPending && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("settings:externalLinks.addResource")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="work-project-link-url">
                {t("settings:externalLinks.url")}
              </Label>
              <Input
                id="work-project-link-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="work-project-link-title">
                {t("settings:externalLinks.titleOptional")}
              </Label>
              <Input
                id="work-project-link-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={add.isPending}
            >
              {t("settings:externalLinks.cancel")}
            </Button>
            <Button type="submit" disabled={add.isPending || !url.trim()}>
              {add.isPending
                ? t("settings:externalLinks.adding")
                : t("settings:externalLinks.addResource")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
