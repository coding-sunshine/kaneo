import { InfoIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type BackupsOffNoticeProps = {
  missingEnv: string[];
};

export function BackupsOffNotice({ missingEnv }: BackupsOffNoticeProps) {
  const { t } = useTranslation();

  return (
    <Alert variant="warning">
      <InfoIcon aria-hidden="true" />
      <AlertTitle>{t("settings:adminBackups.off.title")}</AlertTitle>
      <AlertDescription>
        {t("settings:adminBackups.off.description", {
          settings: missingEnv.join(", "),
        })}
      </AlertDescription>
    </Alert>
  );
}
