import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { RecoveryCodesList } from "./recovery-codes-list";
import {
  TWO_FACTOR_CODE_LENGTH,
  TwoFactorCodeInput,
} from "./two-factor-code-input";
import { TwoFactorQrCode } from "./two-factor-qr-code";

type Enrollment = { totpURI: string; backupCodes: string[] };

type TwoFactorSetupFlowProps = {
  onDone: () => void;
};

/** Password, then scan and confirm a code, then keep the recovery codes. */
export function TwoFactorSetupFlow({ onDone }: TwoFactorSetupFlowProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    const result = await authClient.twoFactor.enable({
      password,
      method: "totp",
    });
    setPending(false);
    if (result.error || result.data?.method !== "totp") {
      setError(
        result.error?.message || t("settings:securityPage.twoFactor.failed"),
      );
      return;
    }
    setEnrollment(result.data);
  };

  const confirm = async (value: string) => {
    if (value.length !== TWO_FACTOR_CODE_LENGTH) return;
    setPending(true);
    setError(null);
    const result = await authClient.twoFactor.verifyTotp({ code: value });
    setPending(false);
    if (result.error) {
      setError(t("settings:securityPage.twoFactor.wrongCode"));
      setCode("");
      return;
    }
    setVerified(true);
  };

  const errorMessage = error ? (
    <p
      id="two-factor-setup-error"
      role="alert"
      className="text-destructive-foreground text-sm"
    >
      {error}
    </p>
  ) : null;

  if (enrollment && verified) {
    return (
      <div className="flex flex-col gap-4">
        <RecoveryCodesList codes={enrollment.backupCodes} />
        <Button type="button" onClick={onDone}>
          {t("settings:securityPage.twoFactor.done")}
        </Button>
      </div>
    );
  }

  if (enrollment) {
    const secret = new URL(enrollment.totpURI).searchParams.get("secret");
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm(code);
        }}
      >
        <p className="text-muted-foreground text-sm">
          {t("settings:securityPage.twoFactor.scanHint")}
        </p>
        <div className="flex flex-col items-center gap-2">
          <TwoFactorQrCode
            value={enrollment.totpURI}
            label={t("settings:securityPage.twoFactor.qrLabel")}
          />
          <p className="text-center text-muted-foreground text-xs">
            {t("settings:securityPage.twoFactor.secretHint")}{" "}
            <code className="break-all font-mono text-foreground">
              {secret}
            </code>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="two-factor-setup-code">
            {t("settings:securityPage.twoFactor.codeLabel")}
          </Label>
          <TwoFactorCodeInput
            id="two-factor-setup-code"
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
              if (value.length === TWO_FACTOR_CODE_LENGTH) void confirm(value);
            }}
            disabled={pending}
            errorId={error ? "two-factor-setup-error" : undefined}
          />
          {errorMessage}
        </div>
        <Button type="submit" loading={pending}>
          {t("settings:securityPage.twoFactor.verify")}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void start();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="two-factor-setup-password">
          {t("settings:securityPage.currentPassword")}
        </Label>
        <Input
          id="two-factor-setup-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "two-factor-setup-error" : undefined}
          autoFocus
        />
        {errorMessage}
      </div>
      <Button type="submit" loading={pending} disabled={!password}>
        {t("settings:securityPage.twoFactor.continue")}
      </Button>
    </form>
  );
}
