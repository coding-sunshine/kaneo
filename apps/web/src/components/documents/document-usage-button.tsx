import { ChartColumn } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { DocumentUsageDialog } from "./document-usage-dialog";

type DocumentUsageButtonProps = { workspaceId: string };

// The numbers count documents the reader cannot open, so only a workspace
// owner gets the button. The route refuses everybody else as well.
export function DocumentUsageButton({ workspaceId }: DocumentUsageButtonProps) {
  const { t } = useTranslation();
  const { role } = useWorkspacePermission();
  const [open, setOpen] = useState(false);
  if (!role?.split(",").includes("owner")) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChartColumn aria-hidden />
        {t("navigation:documents.usage.open")}
      </Button>
      {open && (
        <DocumentUsageDialog
          workspaceId={workspaceId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
