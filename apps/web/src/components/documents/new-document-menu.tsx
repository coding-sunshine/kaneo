import { FilePlus, LayoutTemplate, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { TemplatePickerDialog } from "./template-picker-dialog";
import { useNewDocument } from "./use-new-document";

/** New document: a blank page, or one from a template. */
export function NewDocumentMenu({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { create, isPending } = useNewDocument(workspaceId);
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              disabled={isPending}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <Plus aria-hidden />
          {t("navigation:documents.newDocument")}
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-48">
          <MenuItem onClick={() => create()}>
            <FilePlus aria-hidden />
            {t("navigation:documents.templates.blank")}
          </MenuItem>
          <MenuItem onClick={() => setPicking(true)}>
            <LayoutTemplate aria-hidden />
            {t("navigation:documents.templates.fromTemplate")}
          </MenuItem>
        </MenuPopup>
      </Menu>
      {picking && (
        <TemplatePickerDialog
          workspaceId={workspaceId}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
