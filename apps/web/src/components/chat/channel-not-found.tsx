import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function ChannelNotFound({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="text-sm font-medium">{t("navigation:chat.notFound")}</p>
      <Link
        to="/dashboard/workspace/$workspaceId/channels"
        params={{ workspaceId }}
        className="text-sm text-muted-foreground underline"
      >
        {t("navigation:chat.browse")}
      </Link>
    </div>
  );
}
