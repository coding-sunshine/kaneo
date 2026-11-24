import { brand } from "@kaneo/brand";
import { useTranslation } from "react-i18next";

export function KaneoBranding() {
  const { t } = useTranslation();

  return (
    <a
      href={brand.url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-foreground transition-colors"
    >
      {t("publicProject:branding.poweredBy")}{" "}
      <span className="font-medium">{brand.name}</span>
    </a>
  );
}
