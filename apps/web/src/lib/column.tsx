import { StatusIcon, type StatusKind } from "@/components/icons/status-icon";
import columnIcons, {
  DEFAULT_COLUMN_ICON_NAMES,
} from "@/constants/column-icons";

// Stock icons render as Linear-style partial circles; any other icon the
// admin picked for a column stays as chosen.
const STATUS_KIND_BY_ICON: Record<string, StatusKind> = {
  Circle: "todo",
  CircleDot: "started",
  Search: "review",
  CheckCircle2: "done",
  CircleDashed: "backlog",
  Clock: "backlog",
  Archive: "canceled",
};

const CANCELED_SLUGS = new Set(["canceled", "cancelled"]);

export const getColumnIcon = (
  columnId: string,
  isFinal?: boolean,
  iconName?: string | null,
) => {
  const resolvedIconName =
    iconName ||
    (Object.hasOwn(DEFAULT_COLUMN_ICON_NAMES, columnId)
      ? DEFAULT_COLUMN_ICON_NAMES[
          columnId as keyof typeof DEFAULT_COLUMN_ICON_NAMES
        ]
      : undefined);

  if (CANCELED_SLUGS.has(columnId) && !iconName) {
    return <StatusIcon kind="canceled" />;
  }

  const kind =
    typeof resolvedIconName === "string" &&
    Object.hasOwn(STATUS_KIND_BY_ICON, resolvedIconName)
      ? STATUS_KIND_BY_ICON[resolvedIconName]
      : undefined;
  if (kind) return <StatusIcon kind={kind} />;

  const Icon =
    typeof resolvedIconName === "string" &&
    Object.hasOwn(columnIcons, resolvedIconName) &&
    columnIcons[resolvedIconName as keyof typeof columnIcons];
  if (Icon) {
    return <Icon className="w-4 h-4 text-muted-foreground" />;
  }

  return <StatusIcon kind={isFinal ? "done" : "todo"} />;
};
