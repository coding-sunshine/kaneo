import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import AddEmojiDialog from "./emoji-picker/add-emoji-dialog";
import EmojiPicker from "./emoji-picker/emoji-picker";

type AddReactionButtonProps = {
  onSelect: (emoji: string) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export default function AddReactionButton({
  onSelect,
  onOpenChange,
  className,
}: AddReactionButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [addingEmoji, setAddingEmoji] = useState(false);
  const { canCreateTasks } = useWorkspacePermission();
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("activity:reactions.add")}
              title={t("activity:reactions.add")}
              className={cn(
                "h-6 w-6 rounded-md p-0 text-muted-foreground hover:text-foreground",
                className,
              )}
            />
          }
        >
          <SmilePlus className="size-3.5" />
        </PopoverTrigger>
        <PopoverPopup align="end" className="p-0">
          <EmojiPicker
            onSelect={(emoji) => {
              onSelect(emoji);
              changeOpen(false);
            }}
            onAddEmoji={
              canCreateTasks()
                ? () => {
                    changeOpen(false);
                    setAddingEmoji(true);
                  }
                : undefined
            }
          />
        </PopoverPopup>
      </Popover>
      <AddEmojiDialog open={addingEmoji} onOpenChange={setAddingEmoji} />
    </>
  );
}
