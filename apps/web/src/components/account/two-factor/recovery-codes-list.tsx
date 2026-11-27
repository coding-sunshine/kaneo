import { CopyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";

type RecoveryCodesListProps = {
  codes: string[];
};

export function RecoveryCodesList({ codes }: RecoveryCodesListProps) {
  const { t } = useTranslation();

  const copy = async () => {
    if (await copyToClipboard(codes.join("\n"))) {
      toast.success(t("settings:securityPage.twoFactor.codesCopied"));
    } else {
      toast.error(t("settings:securityPage.twoFactor.copyFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {t("settings:securityPage.twoFactor.codesHint")}
      </p>
      <ul
        aria-label={t("settings:securityPage.twoFactor.codesTitle")}
        className="grid grid-cols-2 gap-1.5 rounded-md border bg-muted/40 p-3 font-mono text-sm tabular-nums"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={copy}
      >
        <CopyIcon aria-hidden="true" />
        {t("settings:securityPage.twoFactor.copyCodes")}
      </Button>
    </div>
  );
}
