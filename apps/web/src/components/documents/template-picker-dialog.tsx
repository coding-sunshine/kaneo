import { FileText, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteDocumentTemplate } from "@/hooks/mutations/document/use-document-template-mutations";
import { useDocumentTemplates } from "@/hooks/queries/document/use-document-templates";
import { toast } from "@/lib/toast";
import { BUILT_IN_TEMPLATES, builtInContent } from "./built-in-templates";
import { useNewDocument } from "./use-new-document";

type TemplatePickerDialogProps = { workspaceId: string; onClose: () => void };

const row =
  "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50";

/** New document, From template: the built-in templates and the saved ones. */
export function TemplatePickerDialog({
  workspaceId,
  onClose,
}: TemplatePickerDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const templates = useDocumentTemplates(workspaceId);
  const remove = useDeleteDocumentTemplate(workspaceId);
  const { create, isPending } = useNewDocument(workspaceId);
  const saved = templates.data ?? [];

  const onDelete = (id: string) =>
    remove.mutate(id, {
      onSuccess: () =>
        toast.success(t("navigation:documents.templates.deleted")),
      onError: (error) => toast.error(error.message),
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.templates.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.templates.hint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <section className="flex flex-col gap-0.5">
            <h3 className="px-2 font-medium text-muted-foreground text-xs">
              {t("navigation:documents.templates.builtInHeading")}
            </h3>
            {BUILT_IN_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className={row}
                disabled={isPending}
                aria-label={t(template.name)}
                aria-describedby={`template-hint-${template.id}`}
                onClick={() =>
                  create({
                    title: t(template.name),
                    content: builtInContent(template, t),
                  })
                }
              >
                <FileText
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <span className="flex min-w-0 flex-col">
                  <span>{t(template.name)}</span>
                  <span
                    id={`template-hint-${template.id}`}
                    className="text-muted-foreground text-xs"
                  >
                    {t(template.hint)}
                  </span>
                </span>
              </button>
            ))}
          </section>
          <section className="flex flex-col gap-0.5">
            <h3 className="px-2 font-medium text-muted-foreground text-xs">
              {t("navigation:documents.templates.savedHeading")}
            </h3>
            {saved.length === 0 && (
              <p className="px-2 py-1.5 text-muted-foreground text-xs">
                {templates.isLoading
                  ? t("navigation:documents.templates.loading")
                  : t("navigation:documents.templates.noneSaved")}
              </p>
            )}
            {saved.map((template) => (
              <div key={template.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className={row}
                  disabled={isPending}
                  onClick={() =>
                    create({ title: template.title, content: template.content })
                  }
                >
                  <FileText
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{template.name}</span>
                </button>
                {template.creatorId === user?.id && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("navigation:documents.templates.delete")}
                    disabled={remove.isPending}
                    onClick={() => onDelete(template.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
            ))}
          </section>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
