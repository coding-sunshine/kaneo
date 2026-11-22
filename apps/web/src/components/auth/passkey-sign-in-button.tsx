import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

type PasskeySignInButtonProps = {
  disabled?: boolean;
  onSuccess: () => void;
};

export function PasskeySignInButton({
  disabled,
  onSuccess,
}: PasskeySignInButtonProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const signIn = async () => {
    setPending(true);
    try {
      const result = await authClient.signIn.passkey();
      if (result?.error) throw new Error(result.error.message);
      onSuccess();
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : t("auth:signIn.passkeyError"),
      );
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full"
      loading={pending}
      disabled={disabled}
      onClick={signIn}
    >
      <KeyRoundIcon aria-hidden="true" />
      {t("auth:signIn.passkey")}
    </Button>
  );
}
