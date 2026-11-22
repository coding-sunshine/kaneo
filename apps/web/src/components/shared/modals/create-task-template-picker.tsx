import { Check, FileText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useGetIssueTemplates from "@/hooks/queries/issue-template/use-get-issue-templates";
import type { IssueTemplate } from "@/components/project/issue-templates/issue-template-dialog";

type CreateTaskTemplatePickerProps = {
  projectId: string;
  selectedId: string | null;
  onPick: (template: IssueTemplate) => void;
};

export function CreateTaskTemplatePicker({
  projectId,
  selectedId,
  onPick,
}: CreateTaskTemplatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: templates = [] } = useGetIssueTemplates(projectId);

  if (templates.length === 0) return null;

  const selected = templates.find((template) => template.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50 text-muted-foreground"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>
            {selected?.name ?? t("common:modals.createTask.template")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 text-left transition-colors h-8"
            onClick={() => {
              onPick(template);
              setOpen(false);
            }}
          >
            <span className="truncate">{template.name}</span>
            {template.id === selectedId && (
              <Check className="ml-auto h-4 w-4 shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
