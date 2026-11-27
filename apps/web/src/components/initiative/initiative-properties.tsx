import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  InitiativeDetail,
  UpdateInitiativeInput,
} from "@/fetchers/initiative/types";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";

const NO_OWNER = "none";

type Props = {
  workspaceId: string;
  initiative: InitiativeDetail;
  editable: boolean;
  onChange: (patch: UpdateInitiativeInput) => void;
};

export function InitiativeProperties({
  workspaceId,
  initiative,
  editable,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const members = users?.members ?? [];
  const owner = members.find((m) => m.userId === initiative.ownerId);

  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-2 text-[13px]">
      <span className="text-muted-foreground">
        {t("workspace:initiative.fields.owner")}
      </span>
      <Select
        value={initiative.ownerId ?? NO_OWNER}
        disabled={!editable}
        onValueChange={(next) =>
          onChange({ ownerId: !next || next === NO_OWNER ? null : next })
        }
      >
        <SelectTrigger
          size="sm"
          aria-label={t("workspace:initiative.fields.owner")}
          className="w-56"
        >
          <SelectValue>
            {owner?.user?.name ?? t("workspace:initiative.fields.noOwner")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_OWNER}>
            {t("workspace:initiative.fields.noOwner")}
          </SelectItem>
          {members.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.user?.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">
        {t("workspace:initiative.fields.targetDate")}
      </span>
      <Input
        type="date"
        disabled={!editable}
        value={initiative.targetDate?.slice(0, 10) ?? ""}
        onChange={(e) =>
          onChange({
            targetDate: e.target.value
              ? new Date(`${e.target.value}T00:00:00.000Z`).toISOString()
              : null,
          })
        }
        aria-label={t("workspace:initiative.fields.targetDate")}
        className="w-56"
      />
    </div>
  );
}
