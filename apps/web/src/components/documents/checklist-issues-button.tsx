import type { Editor } from "@tiptap/core";
import { ListTodo } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { checklistLines } from "./checklist-issues";

type Props = {
  editor: Editor;
  onOpen: (editor: Editor, lines: ReturnType<typeof checklistLines>) => void;
};

/** Bubble menu button that turns the open lines of a checklist into issues. */
export function ChecklistIssuesButton({ editor, onOpen }: Props) {
  const { t } = useTranslation();
  if (!editor.isActive("taskList")) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="kaneo-comment-editor-bubble-btn w-auto gap-1 px-1.5"
      title={t("navigation:documents.checklist.createHint")}
      onClick={() => onOpen(editor, checklistLines(editor))}
    >
      <ListTodo className="size-3.5" />
      {t("navigation:documents.checklist.create")}
    </Button>
  );
}
