import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TWO_FACTOR_CODE_LENGTH,
  TwoFactorCodeInput,
} from "@/components/account/two-factor/two-factor-code-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authLinkClassName } from "./auth-link-class";
import { authMessageClassName } from "./auth-form-styles";

type TwoFactorChallengeFormProps = {
  onSuccess: () => void;
};

/** The second sign-in step: an authenticator code, or one recovery code. */
export function TwoFactorChallengeForm({
  onSuccess,
}: TwoFactorChallengeFormProps) {
  const { t } = useTranslation();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (value: string) => {
    if (!value || (!useRecovery && value.length !== TWO_FACTOR_CODE_LENGTH)) {
      return;
    }
    setPending(true);
    setError(null);
    const result = useRecovery
      ? await authClient.twoFactor.verifyBackupCode({ code: value.trim() })
      : await authClient.twoFactor.verifyTotp({ code: value });
    if (result.error) {
      setPending(false);
      setCode("");
      setError(
        result.error.code === "INVALID_TWO_FACTOR_COOKIE"
          ? t("auth:twoFactor.expired")
          : t("auth:twoFactor.wrongCode"),
      );
      return;
    }
    onSuccess();
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void verify(code);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="two-factor-code">
          {useRecovery
            ? t("auth:twoFactor.recoveryLabel")
            : t("auth:twoFactor.codeLabel")}
        </Label>
        {useRecovery ? (
          <Input
            id="two-factor-code"
            size="lg"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "two-factor-code-error" : undefined}
          />
        ) : (
          <TwoFactorCodeInput
            id="two-factor-code"
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
              if (value.length === TWO_FACTOR_CODE_LENGTH && !pending) {
                void verify(value);
              }
            }}
            disabled={pending}
            errorId={error ? "two-factor-code-error" : undefined}
          />
        )}
        {error ? (
          <p
            id="two-factor-code-error"
            role="alert"
            className={authMessageClassName}
          >
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("auth:twoFactor.submit")}
      </Button>
      <button
        type="button"
        className={`${authLinkClassName} self-start text-sm`}
        onClick={() => {
          setUseRecovery((value) => !value);
          setCode("");
          setError(null);
        }}
      >
        {useRecovery
          ? t("auth:twoFactor.useAuthenticator")
          : t("auth:twoFactor.useRecovery")}
      </button>
    </form>
  );
}
