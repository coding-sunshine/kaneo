import { LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = { names: readonly string[] };

export function MemberPrivateTeams({ names }: Props) {
  const { t } = useTranslation();
  if (names.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">
          {t("team:projectAccess.privateTeamsLabel")}
        </p>
        <p className="text-muted-foreground text-xs">
          {t("team:projectAccess.privateTeamsHint")}
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {names.map((name) => (
          <li key={name} className="flex items-center gap-2 text-sm">
            <LockIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
