import { KeyRoundIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";

type PasskeyItem = {
  id: string;
  name?: string | null;
  createdAt?: Date | null;
};

export function PasskeysSettings() {
  const { t } = useTranslation();
  const { data, isPending, error, refetch } = authClient.useListPasskeys();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PasskeyItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const passkeys = (data ?? []) as PasskeyItem[];

  const add = async () => {
    setAdding(true);
    try {
      const result = await authClient.passkey.addPasskey();
      if (result?.error) throw new Error(result.error.message);
      toast.success(t("settings:securityPage.passkeys.toastAdded"));
      await refetch();
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : t("settings:securityPage.passkeys.toastAddError"),
      );
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setDeleting(true);
    try {
      const result = await authClient.passkey.deletePasskey({
        id: removing.id,
      });
      if (result.error) throw new Error(result.error.message);
      toast.success(t("settings:securityPage.passkeys.toastDeleted"));
      setRemoving(null);
      await refetch();
    } catch {
      toast.error(t("settings:securityPage.passkeys.toastDeleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsSection
      title={t("settings:securityPage.passkeys.title")}
      description={t("settings:securityPage.passkeys.description")}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={adding}
          onClick={add}
        >
          <PlusIcon aria-hidden="true" />
          {t("settings:securityPage.passkeys.add")}
        </Button>
      }
    >
      <SettingsCard>
        {isPending ? (
          <SettingsRowsSkeleton rows={1} withDescription />
        ) : error ? (
          <p
            role="alert"
            className="px-4 py-3.5 text-destructive-foreground text-sm"
          >
            {t("settings:securityPage.passkeys.loadError")}
          </p>
        ) : passkeys.length === 0 ? (
          <p className="px-4 py-3.5 text-muted-foreground text-sm">
            {t("settings:securityPage.passkeys.empty")}
          </p>
        ) : (
          passkeys.map((passkey) => {
            const name =
              passkey.name || t("settings:securityPage.passkeys.unnamed");
            return (
              <SettingsRow
                key={passkey.id}
                icon={<KeyRoundIcon />}
                title={name}
                description={
                  passkey.createdAt
                    ? t("settings:securityPage.passkeys.addedOn", {
                        date: formatDateMedium(passkey.createdAt),
                      })
                    : undefined
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t("settings:securityPage.passkeys.deleteLabel", {
                    name,
                  })}
                  onClick={() => setRemoving(passkey)}
                >
                  {t("settings:securityPage.passkeys.delete")}
                </Button>
              </SettingsRow>
            );
          })
        )}
      </SettingsCard>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setRemoving(null);
        }}
        title={t("settings:securityPage.passkeys.deleteConfirmTitle")}
        description={t(
          "settings:securityPage.passkeys.deleteConfirmDescription",
        )}
        confirmLabel={t("settings:securityPage.passkeys.delete")}
        pending={deleting}
        destructive
        onConfirm={remove}
      />
    </SettingsSection>
  );
}
