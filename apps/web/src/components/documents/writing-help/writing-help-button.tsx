import type { Editor } from "@tiptap/core";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type { WritingAction } from "@/fetchers/agent/writing-help";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import type { TextRange } from "./replace-selection";
import { WRITING_ACTIONS } from "./writing-actions";

type Props = {
  editor: Editor;
  onPick: (editor: Editor, action: WritingAction, range: TextRange) => void;
};

/** Bubble menu entry: AI writing help for the selected text. */
export function WritingHelpButton({ editor, onPick }: Props) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  if (!hasAgent || editor.state.selection.empty) return null;
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="kaneo-comment-editor-bubble-btn w-auto gap-1 px-1.5"
          />
        }
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        {t("navigation:documents.writing.menu")}
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-40">
        {WRITING_ACTIONS.map((action) => (
          <MenuItem
            key={action}
            onClick={() => {
              const { from, to } = editor.state.selection;
              onPick(editor, action, { from, to });
            }}
          >
            {t(`navigation:documents.writing.actions.${action}`)}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
