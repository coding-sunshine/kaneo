/** The ticket as a proposal reads it, before the change. */
export type TaskState = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  userId: string | null;
  projectId: string;
  /** Names of the labels on the ticket. */
  labels: string[];
};

export type FieldChange = {
  field: string;
  from: string | null;
  to: string | null;
};

type Args = Record<string, unknown>;

// Tool argument -> diff field, for the tools that set ticket fields.
const FIELDS: Record<string, Record<string, string>> = {
  change_task: { priority: "priority" },
  update_task: {
    title: "title",
    description: "description",
    status: "status",
    priority: "priority",
    projectId: "projectId",
    startDate: "startDate",
    dueDate: "dueDate",
    userId: "userId",
    position: "position",
  },
  update_task_status: { status: "status" },
  update_task_assignee: { userId: "userId" },
  create_task: {
    projectId: "projectId",
    title: "title",
    description: "description",
    priority: "priority",
    status: "status",
    startDate: "startDate",
    dueDate: "dueDate",
    userId: "userId",
    topicId: "topic",
  },
  create_task_comment: { content: "comment" },
};

/**
 * The arguments of `tool` the card shows. Accept runs a write with every
 * argument it stored, so each one must be here.
 */
export function shownArguments(tool: string) {
  return [
    "taskId",
    ...Object.keys(FIELDS[tool] ?? {}),
    ...(tool === "change_task" ? ["addLabels", "removeLabels"] : []),
  ];
}

// Diff field names as the card shows them.
const SHOWN: Record<string, string> = { userId: "assignee", projectId: "team" };

const text = (value: unknown) =>
  value === undefined || value === null || value === "" ? null : String(value);

const names = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : [];

const list = (labels: string[]) =>
  labels.length ? [...labels].sort().join(", ") : null;

/**
 * What a write would change, field by field. `current` is the ticket now, or
 * null for a write that creates something. Unchanged fields are left out.
 */
export function fieldDiff(
  tool: string,
  args: Args,
  current: TaskState | null,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const creates = tool === "create_task" || tool === "create_task_comment";
  for (const [arg, field] of Object.entries(FIELDS[tool] ?? {})) {
    if (!(arg in args)) continue;
    const from =
      creates || !current ? null : text(current[field as keyof TaskState]);
    const to = text(args[arg]);
    if (from !== to) changes.push({ field: SHOWN[field] ?? field, from, to });
  }
  if (tool === "change_task" && current) {
    const remove = new Set(names(args.removeLabels));
    const next = [
      ...new Set([...current.labels, ...names(args.addLabels)]),
    ].filter((label) => !remove.has(label));
    const from = list(current.labels);
    const to = list(next);
    if (from !== to) changes.push({ field: "labels", from, to });
  }
  return changes;
}
