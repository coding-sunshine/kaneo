import { CalendarDays, Minus, Users } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import { AssigneeAvatar } from "@/components/task/properties/assignee-avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { WorkProjectStatus } from "@/fetchers/work-project/types";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import {
  WORK_PROJECT_PRIORITY_KEYS,
  workProjectPriorityFromKey,
  workProjectPriorityKey,
} from "@/lib/work-project/priority";
import { WORK_PROJECT_STATUSES } from "@/lib/work-project/status";
import { WorkProjectStatusIcon } from "./work-project-status-icon";

export type WorkProjectFieldValues = {
  status: WorkProjectStatus;
  priority: number;
  leadId: string | null;
  memberIds: string[];
  teamIds: string[];
  startDate: string | null;
  targetDate: string | null;
};

type Props = {
  workspaceId: string;
  value: WorkProjectFieldValues;
  onChange: (patch: Partial<WorkProjectFieldValues>) => void;
  disabled?: boolean;
};

const NONE = "__none__";

function Pill({
  trigger,
  options,
  label,
  placeholder,
  onSelect,
  keepOpen,
  disabled,
}: {
  trigger: ReactNode;
  options: OptionMenuItem[];
  label: string;
  placeholder: string;
  onSelect: (value: string) => void;
  keepOpen?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 px-2 font-normal text-[13px] [&_svg]:size-3.5"
        >
          {trigger}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={label}
          placeholder={placeholder}
          options={options}
          onSelect={(v) => {
            onSelect(v);
            if (!keepOpen) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function DatePill({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-[13px] text-muted-foreground">
      <CalendarDays className="size-3.5" />
      <span>{label}</span>
      <input
        type="date"
        aria-label={label}
        disabled={disabled}
        value={value ? value.slice(0, 10) : ""}
        onChange={(e) =>
          onChange(
            e.target.value
              ? new Date(`${e.target.value}T00:00:00Z`).toISOString()
              : null,
          )
        }
        className="bg-transparent text-foreground outline-none"
      />
    </label>
  );
}

/** Status, priority, lead, members, teams and dates; shared by the create dialog and the project page. */
export function WorkProjectFields({
  workspaceId,
  value,
  onChange,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: teams = [] } = useGetProjects({ workspaceId });
  const members = useMemo(() => users?.members ?? [], [users]);
  const lead = members.find((m) => m.userId === value.leadId);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const personOptions = (selected: (id: string) => boolean): OptionMenuItem[] =>
    members.map((m) => ({
      value: m.userId,
      label: m.user.name,
      icon: <AssigneeAvatar name={m.user.name} image={m.user.image} assigned />,
      selected: selected(m.userId),
    }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill
        disabled={disabled}
        label={t("workspace:workProject.fields.status")}
        placeholder={t("workspace:workProject.fields.search")}
        trigger={
          <>
            <WorkProjectStatusIcon status={value.status} />
            {t(`workspace:workProject.status.${value.status}`)}
          </>
        }
        options={WORK_PROJECT_STATUSES.map((s) => ({
          value: s,
          label: t(`workspace:workProject.status.${s}`),
          icon: <WorkProjectStatusIcon status={s} />,
          selected: value.status === s,
        }))}
        onSelect={(s) => onChange({ status: s as WorkProjectStatus })}
      />
      <Pill
        disabled={disabled}
        label={t("workspace:workProject.fields.priority")}
        placeholder={t("workspace:workProject.fields.search")}
        trigger={
          <>
            {getPriorityIcon(workProjectPriorityKey(value.priority))}
            {getPriorityLabel(workProjectPriorityKey(value.priority))}
          </>
        }
        options={WORK_PROJECT_PRIORITY_KEYS.map((k) => ({
          value: k,
          label: getPriorityLabel(k),
          icon: getPriorityIcon(k),
          selected: workProjectPriorityKey(value.priority) === k,
        }))}
        onSelect={(k) => onChange({ priority: workProjectPriorityFromKey(k) })}
      />
      <Pill
        disabled={disabled}
        label={t("workspace:workProject.fields.lead")}
        placeholder={t("workspace:workProject.fields.search")}
        trigger={
          <>
            <AssigneeAvatar
              name={lead?.user.name}
              image={lead?.user.image}
              assigned={!!lead}
              className="size-4"
            />
            {lead?.user.name ?? t("workspace:workProject.fields.lead")}
          </>
        }
        options={[
          {
            value: NONE,
            label: t("workspace:workProject.noLead"),
            icon: <Minus className="size-3.5 text-muted-foreground" />,
            selected: !value.leadId,
            pinned: true,
          },
          ...personOptions((id) => id === value.leadId),
        ]}
        onSelect={(id) => onChange({ leadId: id === NONE ? null : id })}
      />
      <Pill
        disabled={disabled}
        keepOpen
        label={t("workspace:workProject.fields.members")}
        placeholder={t("workspace:workProject.fields.search")}
        trigger={
          <>
            <Users />
            {value.memberIds.length
              ? t("workspace:workProject.fields.membersCount", {
                  count: value.memberIds.length,
                })
              : t("workspace:workProject.fields.members")}
          </>
        }
        options={personOptions((id) => value.memberIds.includes(id))}
        onSelect={(id) => onChange({ memberIds: toggle(value.memberIds, id) })}
      />
      <Pill
        disabled={disabled}
        keepOpen
        label={t("workspace:workProject.fields.teams")}
        placeholder={t("workspace:workProject.fields.search")}
        trigger={
          <>
            <Users />
            {value.teamIds.length
              ? t("workspace:workProject.fields.teamsCount", {
                  count: value.teamIds.length,
                })
              : t("workspace:workProject.fields.teams")}
          </>
        }
        options={teams.map((team) => ({
          value: team.id,
          label: team.name,
          selected: value.teamIds.includes(team.id),
        }))}
        onSelect={(id) => onChange({ teamIds: toggle(value.teamIds, id) })}
      />
      <DatePill
        disabled={disabled}
        label={t("workspace:workProject.fields.startDate")}
        value={value.startDate}
        onChange={(startDate) => onChange({ startDate })}
      />
      <DatePill
        disabled={disabled}
        label={t("workspace:workProject.fields.targetDate")}
        value={value.targetDate}
        onChange={(targetDate) => onChange({ targetDate })}
      />
    </div>
  );
}
