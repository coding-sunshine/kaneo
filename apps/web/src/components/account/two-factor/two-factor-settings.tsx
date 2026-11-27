import { ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { StatusBadge } from "@/components/settings/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import useListAccounts from "@/hooks/queries/use-list-accounts";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { RecoveryCodesList } from "./recovery-codes-list";
import { TwoFactorPasswordDialog } from "./two-factor-password-dialog";
import { TwoFactorSetupFlow } from "./two-factor-setup-flow";

type Dialogs = "setup" | "disable" | "regenerate" | null;

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { data: session, refetch } = authClient.useSession();
  const { data: accounts } = useListAccounts();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const enabled = Boolean(session?.user.twoFactorEnabled);
  const hasPassword =
    accounts?.some((account) => account.providerId === "credential") ?? false;

  const disable = async (password: string) => {
    const result = await authClient.twoFactor.disable({ password });
    if (result.error) {
      return (
        result.error.message || t("settings:securityPage.twoFactor.failed")
      );
    }
    toast.success(t("settings:securityPage.twoFactor.turnedOff"));
    await refetch();
    return null;
  };

  const regenerate = async (password: string, code: string) => {
    // The API also wants a current code once two-factor is on; the client's
    // body type predates that field.
    const body = { password, code };
    const result = await authClient.twoFactor.generateBackupCodes(body);
    if (result.error || !result.data) {
      return (
        result.error?.message || t("settings:securityPage.twoFactor.failed")
      );
    }
    setNewCodes(result.data.backupCodes);
    return null;
  };

  return (
    <SettingsSection
      title={t("settings:securityPage.twoFactor.title")}
      description={t("settings:securityPage.twoFactor.description")}
    >
      <SettingsCard>
        <SettingsRow
          icon={<ShieldCheckIcon />}
          title={t("settings:securityPage.twoFactor.rowTitle")}
          description={
            hasPassword
              ? undefined
              : t("settings:securityPage.twoFactor.needsPassword")
          }
        >
          {enabled ? (
            <div className="flex items-center gap-2">
              <StatusBadge tone="success">
                {t("settings:securityPage.twoFactor.on")}
              </StatusBadge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialog("regenerate")}
              >
                {t("settings:securityPage.twoFactor.newCodes")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialog("disable")}
              >
                {t("settings:securityPage.twoFactor.turnOff")}
              </Button>
            </div>
          ) : hasPassword ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("setup")}
            >
              {t("settings:securityPage.twoFactor.turnOn")}
            </Button>
          ) : null}
        </SettingsRow>
      </SettingsCard>

      <Dialog
        open={dialog === "setup"}
        onOpenChange={(open) => setDialog(open ? "setup" : null)}
      >
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("settings:securityPage.twoFactor.setupTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:securityPage.twoFactor.setupDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <TwoFactorSetupFlow
              onDone={() => {
                setDialog(null);
                toast.success(t("settings:securityPage.twoFactor.turnedOn"));
                void refetch();
              }}
            />
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      <TwoFactorPasswordDialog
        open={dialog === "disable"}
        onOpenChange={(open) => setDialog(open ? "disable" : null)}
        title={t("settings:securityPage.twoFactor.disableTitle")}
        description={t("settings:securityPage.twoFactor.disableDescription")}
        confirmLabel={t("settings:securityPage.twoFactor.turnOff")}
        destructive
        onConfirm={disable}
      />
      <TwoFactorPasswordDialog
        open={dialog === "regenerate"}
        onOpenChange={(open) => setDialog(open ? "regenerate" : null)}
        title={t("settings:securityPage.twoFactor.regenerateTitle")}
        description={t("settings:securityPage.twoFactor.regenerateDescription")}
        confirmLabel={t("settings:securityPage.twoFactor.newCodes")}
        askCode
        onConfirm={regenerate}
      />

      <Dialog
        open={newCodes !== null}
        onOpenChange={(open) => {
          if (!open) setNewCodes(null);
        }}
      >
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("settings:securityPage.twoFactor.codesTitle")}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <RecoveryCodesList codes={newCodes ?? []} />
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </SettingsSection>
  );
}
