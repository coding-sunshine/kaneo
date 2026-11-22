type TaskScopedLabel = {
  id?: string;
  name: string;
  taskId: string | null;
  projectId?: string | null;
  parentLabelId?: string | null;
  deletionStartedAt?: string | Date | null;
};

// Team labels only show for that team's issues; label groups cannot be
// picked themselves, only their children.
export function selectableLabels<T extends TaskScopedLabel>(
  labels: T[],
  projectId?: string,
) {
  const groupIds = new Set(labels.map((label) => label.parentLabelId));
  return labels.filter(
    (label) =>
      (!label.projectId || label.projectId === projectId) &&
      !(label.taskId === null && label.id && groupIds.has(label.id)),
  );
}

export function getTaskLabelOptions<T extends TaskScopedLabel>(
  allLabels: T[],
  taskId: string,
  projectId?: string,
) {
  const labels = selectableLabels(allLabels, projectId);
  const labelMap = new Map<string, T>();
  const deletingNames = new Set(
    labels
      .filter((label) => label.deletionStartedAt)
      .map((label) => label.name),
  );

  for (const label of labels) {
    if (deletingNames.has(label.name)) continue;
    if (label.taskId !== null && label.taskId !== taskId) continue;

    const existing = labelMap.get(label.name);
    if (!existing || (label.taskId === null && existing.taskId !== null)) {
      labelMap.set(label.name, label);
    }
  }

  const byId = new Map(allLabels.map((label) => [label.id, label]));
  return Array.from(labelMap.values()).map((label) => {
    const parent = label.parentLabelId ? byId.get(label.parentLabelId) : null;
    return {
      ...label,
      displayName: parent ? `${parent.name} / ${label.name}` : label.name,
    };
  });
}
