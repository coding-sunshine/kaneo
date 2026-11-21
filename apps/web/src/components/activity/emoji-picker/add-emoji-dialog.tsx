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
import useCreateWorkspaceEmoji from "@/hooks/mutations/emoji/use-create-workspace-emoji";
import { HttpError } from "@/lib/http-error";
import { EMOJI_NAME_PATTERN, prepareEmojiImage } from "./custom-emoji";

type AddEmojiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AddEmojiDialog({
  open,
  onOpenChange,
}: AddEmojiDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useCreateWorkspaceEmoji();

  const change = (next: boolean) => {
    if (!next) {
      setName("");
      setFile(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!EMOJI_NAME_PATTERN.test(name))
      return setError(t("activity:reactions.emojiNameInvalid"));
    if (!file) return setError(t("activity:reactions.emojiImageRequired"));
    setError(null);
    try {
      await mutateAsync({ name, file: await prepareEmojiImage(file) });
      change(false);
    } catch (caught) {
      setError(
        caught instanceof HttpError && caught.status === 409
          ? caught.message
          : t("activity:reactions.emojiFailed"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogPopup className="max-w-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("activity:reactions.addEmoji")}</DialogTitle>
            <DialogDescription>
              {t("activity:reactions.emojiHelp")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-3">
            <Input
              // biome-ignore lint/a11y/noAutofocus: the dialog opens to type into
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value.toLowerCase())}
              placeholder={t("activity:reactions.emojiName")}
              aria-label={t("activity:reactions.emojiName")}
            />
            <Input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              aria-label={t("activity:reactions.emojiImage")}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => change(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {t("activity:reactions.emojiSave")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
