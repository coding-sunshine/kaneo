import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TWO_FACTOR_CODE_LENGTH,
  TwoFactorCodeInput,
} from "./two-factor-code-input";

type TwoFactorPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Also ask for a current authenticator code. */
  askCode?: boolean;
  /** Resolves to an error message, or null when the action worked. */
  onConfirm: (password: string, code: string) => Promise<string | null>;
};

/** Asks for the account password, and a code if needed, before a two-factor change. */
export function TwoFactorPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  askCode = false,
  onConfirm,
}: TwoFactorPasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (!next) {
      setPassword("");
      setCode("");
      setError(null);
    }
    onOpenChange(next);
  };

  const confirm = async () => {
    setPending(true);
    const message = await onConfirm(password, code);
    setPending(false);
    if (message) setError(message);
    else close(false);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pending={pending}
      destructive={destructive}
      confirmDisabled={
        !password || (askCode && code.length < TWO_FACTOR_CODE_LENGTH)
      }
      onConfirm={confirm}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="two-factor-password">
          {t("settings:securityPage.currentPassword")}
        </Label>
        <Input
          id="two-factor-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "two-factor-password-error" : undefined}
        />
        {askCode ? (
          <>
            <Label htmlFor="two-factor-current-code">
              {t("settings:securityPage.twoFactor.currentCode")}
            </Label>
            <TwoFactorCodeInput
              id="two-factor-current-code"
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              autoFocus={false}
              errorId={error ? "two-factor-password-error" : undefined}
            />
          </>
        ) : null}
        {error ? (
          <p
            id="two-factor-password-error"
            role="alert"
            className="text-destructive-foreground text-sm"
          >
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
